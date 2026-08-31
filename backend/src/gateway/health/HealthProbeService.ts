import { HealthTracker } from './HealthTracker.js';
import type { HealthSample, ProviderStatus } from './types.js';
import { averageLatencyMs } from './metrics.js';

/**
 * Read-side throttle window for real probes (T-18-02): a provider is
 * re-probed at most once per THROTTLE_MS regardless of how many callers
 * (dashboard tabs, endpoint hits) request a snapshot within that window.
 */
export const THROTTLE_MS = 60_000;

/**
 * Fixed, synthetic, non-PII probe query used for automated health checks.
 * This is deliberately NOT the `'Maria'` default used by the human-facing
 * `/api/dev/inspect/:id` endpoint — that is a real name. Per-provider
 * configurable probe queries are deferred to HEALTH-F1. This token MUST
 * NEVER be logged or returned in an HTTP response body (T-18-01).
 */
export const HEALTH_PROBE_QUERY = '__health_probe__';

/**
 * The subset of ProviderGateway.inspect()'s discriminated-union result the
 * probe path is allowed to read. `query`, `sample`, and `error` are
 * intentionally NOT part of this type — the probe path must never read
 * (and therefore can never leak) those fields (T-18-01).
 */
export type InspectResult =
  | { status: 'ok'; normalizedResults: number; elapsedMs?: number; newestObservationAt?: number; oldestObservationAt?: number }
  | { status: 'error'; elapsedMs?: number; errorDetail?: string }
  | { status: 'not_found' };

/**
 * Structural, no-PII per-provider health snapshot. Contains only metrics
 * derived from the HealthTracker — never a query string, payload, or
 * result sample. Badge labels / availability percentage strings are a
 * Phase 19 (HEALTH-08/09) rendering concern, not this service's job.
 */
export interface ProviderHealthSnapshot {
  providerStatus: ProviderStatus;
  averageLatencyMs: number | null;
  lastSuccessAt: number | null;
  lastSuccessfulDataRetrievalAt: number | null;
  consecutiveFailures: number;
  lastErrorDetail: string | null;
  samples: HealthSample[];
  up: number;
  total: number;
}

/**
 * Collapse an inspect() result into the HealthTracker's four-state status
 * vocabulary. `ok` with zero `normalizedResults` still counts as reachable
 * ("empty") per HEALTH-07 — classification into up/down happens downstream
 * in `classifyOutcome`, this only decides which of the four raw statuses
 * applies. `not_found` is passed through unclassified so the tracker's
 * HEALTH-07 exclusion (no adapter registered) can apply.
 */
export function mapInspectToStatus(result: InspectResult): 'ok' | 'empty' | 'error' | 'not_found' {
  switch (result.status) {
    case 'ok':
      return result.normalizedResults > 0 ? 'ok' : 'empty';
    case 'error':
      return 'error';
    case 'not_found':
      return 'not_found';
  }
}

/**
 * Assemble a ProviderHealthSnapshot for one provider from the tracker's
 * current state. `lastSuccessAt` / `consecutiveFailures` are read from the
 * tracker's independent counters (NOT the window-scoped metrics.ts
 * functions) so they survive failure streaks longer than HEALTH_WINDOW.
 */
export function assembleSnapshot(tracker: HealthTracker, providerId: string): ProviderHealthSnapshot {
  const samples = tracker.samples(providerId);
  const up = samples.filter((s) => s.outcome === 'up').length;
  // find latest error detail in the tracker record
  const record = (tracker as any).providers?.get(providerId);
  
  return {
    providerStatus: tracker.deriveStatus(providerId),
    averageLatencyMs: averageLatencyMs(samples),
    lastSuccessAt: tracker.lastSuccessAt(providerId),
    lastSuccessfulDataRetrievalAt: tracker.lastSuccessfulDataRetrievalAt(providerId),
    consecutiveFailures: tracker.consecutiveFailures(providerId),
    lastErrorDetail: record?.lastErrorDetail ?? null,
    samples,
    up,
    total: samples.length,
  };
}

interface HealthProbeServiceOptions {
  tracker: HealthTracker;
  probe: (providerId: string, query: string) => Promise<InspectResult>;
  throttleMs?: number;
  now?: () => number;
}

/**
 * Orchestrates the probe -> HealthTracker pipeline with a per-provider
 * read-side throttle and an in-flight stampede guard (T-18-02): probing
 * 16+ real (some scraped) upstreams must never scale with the number of
 * open dashboard tabs or concurrent endpoint callers, or we risk getting
 * rate-limited/IP-banned mid-disaster.
 *
 * The clock and probe function are injected via the constructor so the
 * throttle/stampede behavior is deterministically unit-testable without
 * real timers or real network calls.
 */
export class HealthProbeService {
  private readonly tracker: HealthTracker;
  private readonly probeFn: (providerId: string, query: string) => Promise<InspectResult>;
  private readonly throttleMs: number;
  private readonly now: () => number;
  private readonly lastProbedAt = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(opts: HealthProbeServiceOptions) {
    this.tracker = opts.tracker;
    this.probeFn = opts.probe;
    this.throttleMs = opts.throttleMs ?? THROTTLE_MS;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Probe (or skip, per throttle) every requested provider id, then return
   * a snapshot map keyed by id. Never rejects — a single provider that
   * throws is recorded DOWN and every other provider is probed/assembled
   * independently (degrade-safe, T-18-03).
   */
  async probeAll(providerIds: string[]): Promise<Record<string, ProviderHealthSnapshot>> {
    await Promise.all(providerIds.map((id) => this.maybeProbe(id)));

    const result: Record<string, ProviderHealthSnapshot> = {};
    for (const id of providerIds) {
      result[id] = assembleSnapshot(this.tracker, id);
    }
    return result;
  }

  private shouldProbe(id: string): boolean {
    const last = this.lastProbedAt.get(id);
    return last === undefined || this.now() - last >= this.throttleMs;
  }

  /**
   * Decide probe-vs-skip, then dedupe concurrent probes for the same id.
   * The synchronous section below (throttle check through `inFlight.set`)
   * runs to completion before any `await` yields control, so two
   * near-simultaneous callers can never both start a real probe for the
   * same provider (the stampede guard).
   */
  private async maybeProbe(id: string): Promise<void> {
    if (!this.shouldProbe(id)) return;

    const existing = this.inFlight.get(id);
    if (existing) {
      await existing;
      return;
    }

    const task = this.runProbe(id);
    this.inFlight.set(id, task);
    try {
      await task;
    } finally {
      this.inFlight.delete(id);
    }
  }

  private async runProbe(id: string): Promise<void> {
    const startedAt = this.now();
    try {
      const result = await this.probeFn(id, HEALTH_PROBE_QUERY);
      const status = mapInspectToStatus(result);
      const elapsedMs = 'elapsedMs' in result && typeof result.elapsedMs === 'number' ? result.elapsedMs : undefined;
      
      const opts: any = {};
      if (result.status === 'ok') {
        opts.newestObservationAt = result.newestObservationAt;
        opts.oldestObservationAt = result.oldestObservationAt;
      } else if (result.status === 'error') {
        opts.errorDetail = result.errorDetail;
      }

      this.tracker.record(id, status, elapsedMs ?? this.now() - startedAt, this.now(), opts);
    } catch {
      // A throwing probe fn is never a health signal we can inspect for
      // detail — record DOWN with a measured elapsed and never rethrow, so
      // probeAll can never reject because of one bad provider (T-18-03).
      this.tracker.record(id, 'error', this.now() - startedAt, this.now(), { errorDetail: 'Probe function threw an error' });
    } finally {
      this.lastProbedAt.set(id, this.now());
    }
  }
}
