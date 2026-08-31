/**
 * Pure, framework-free health derivations for the Provider Health dashboard
 * (Phase 19). This module owns no fetch/React/timers — it only transforms
 * a `ProviderHealthSnapshot` (mirroring the shipped `GET /api/health/providers`
 * response) into the badge state, availability string, and sparkline geometry
 * the presentational components (Plan 02) render.
 *
 * Every function here is pure: same input always produces the same output,
 * no side effects, no ambient clock reads (callers pass in what they need).
 */

/** Collapsed two-state outcome a classified probe result maps onto (mirrors backend). */
export type HealthOutcome = 'up' | 'down';

export type ProviderStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';

/**
 * One recorded health check. `latencyMs` is null for DOWN samples — an
 * errored probe never completes a timed response.
 */
export interface HealthSample {
  outcome: HealthOutcome;
  status: 'ok' | 'empty' | 'error' | 'not_found';
  latencyMs: number | null;
  timestamp: number;
  newestObservationAt?: number;
  oldestObservationAt?: number;
  errorDetail?: string;
}

/**
 * Structural, no-PII per-provider health snapshot. Mirrors
 * `repo/backend/src/gateway/health/HealthProbeService.ts`'s
 * `ProviderHealthSnapshot` exactly (shipped Phase 18 endpoint response shape).
 *
 * `samples` is OLDEST-FIRST — it comes straight from the backend's
 * RingBuffer.toArray() (see `repo/backend/src/gateway/health/ringBuffer.ts`),
 * which returns "current contents, oldest first". So the LATEST sample is
 * `samples[samples.length - 1]`, and a chronological left-to-right sparkline
 * needs no reversal.
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
 * The literal token returned by `formatAvailability` when `total === 0`.
 * Callers map this to a localized "warming up" label — it is deliberately
 * NOT a percentage string so it can never be mistaken for a real reading.
 */
export const AVAILABILITY_WARMING_TOKEN = 'warming';

/**
 * Format availability as `NN% (up/total)` — the sample size is always
 * shown alongside the percentage so a 100% reading over 1 sample reads
 * differently from 100% over 180 (HEALTH-09).
 *
 * `total === 0` returns the literal string 'warming' (see
 * AVAILABILITY_WARMING_TOKEN) BEFORE any division, so the UI never
 * renders NaN/Infinity or a misleading 100% for a provider that has not
 * been probed yet (T-19-02).
 */
export function formatAvailability(snapshot: ProviderHealthSnapshot): string {
  if (snapshot.total === 0) {
    return AVAILABILITY_WARMING_TOKEN;
  }
  const pct = Math.round((snapshot.up / snapshot.total) * 100);
  return `${pct}% (${snapshot.up}/${snapshot.total})`;
}

/** A marker drawn at the sparkline's baseline for a DOWN (null-latency) sample. */
export interface SparklineMarker {
  x: number;
  y: number;
}

/** Result of `buildSparkline`: an SVG `<polyline>` points string + DOWN markers. */
export interface SparklineResult {
  points: string;
  markers: SparklineMarker[];
}

export interface SparklineOptions {
  width: number;
  height: number;
  padding: number;
}

/**
 * Map a windowed, oldest-first `HealthSample[]` (per the RingBuffer contract
 * documented on `ProviderHealthSnapshot.samples`) into hand-computed SVG
 * geometry for a response-time sparkline (HEALTH-10). No charting library.
 *
 * DOWN samples always have `latencyMs === null` (backend invariant) and are
 * deliberately EXCLUDED from the polyline `points` — including them as 0ms
 * would draw a misleading zero-latency dip. Instead each DOWN sample emits
 * a baseline marker (at the bottom axis) so downtime reads as a visible
 * gap + marker, never a fake fast response.
 *
 * Non-finite latency values (NaN/Infinity — T-19-01, tampered/corrupt input)
 * are treated the same as a DOWN sample: skipped from the polyline and
 * emitted as a baseline marker, so a broken numeric input can never produce
 * a broken SVG coordinate.
 */
export function buildSparkline(samples: HealthSample[], opts: SparklineOptions): SparklineResult {
  const { width, height, padding } = opts;
  const baselineY = height - padding;

  if (samples.length === 0) {
    return { points: '', markers: [] };
  }

  const usableWidth = Math.max(width - padding * 2, 0);
  const usableHeight = Math.max(height - padding * 2, 0);
  const lastIndex = Math.max(samples.length - 1, 1); // avoid div-by-zero for a single sample

  const upLatencies = samples
    .map((s) => s.latencyMs)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const maxLatency = upLatencies.length > 0 ? Math.max(...upLatencies) : 0;
  const minLatency = upLatencies.length > 0 ? Math.min(...upLatencies) : 0;
  const latencyRange = maxLatency - minLatency || 1; // avoid div-by-zero when flat

  const points: string[] = [];
  const markers: SparklineMarker[] = [];

  samples.forEach((s, i) => {
    const x = padding + (samples.length === 1 ? usableWidth / 2 : (usableWidth * i) / lastIndex);

    const isFiniteUp = s.outcome === 'up' && typeof s.latencyMs === 'number' && Number.isFinite(s.latencyMs);

    if (!isFiniteUp) {
      markers.push({ x, y: baselineY });
      return;
    }

    // Invert so higher latency draws higher on screen (smaller y).
    const normalized = (s.latencyMs! - minLatency) / latencyRange;
    const y = padding + usableHeight * (1 - normalized);
    points.push(`${x},${y}`);
  });

  return { points: points.join(' '), markers };
}
