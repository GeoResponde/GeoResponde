import { RingBuffer } from './ringBuffer.js';
import { classifyOutcome, HealthSample, HEALTH_WINDOW, ProviderStatus, DOWN_THRESHOLD } from './types.js';

/**
 * Volatile, per-provider health tracker. Follows the VolatileTtlCache ethos
 * from transports/cache.ts: VOLATILE ONLY, in-memory, no persistence, no
 * Redis/DB — history and counters reset on cold start and are per-instance
 * (the proposal's disclosed tradeoff).
 *
 * Each provider gets a windowed RingBuffer<HealthSample> (capacity
 * HEALTH_WINDOW) for latency + response history, PLUS INDEPENDENT
 * fields that are updated directly on every record() rather than derived
 * by scanning the windowed buffer.
 *
 * Stores only outcome + latency + timestamp (+ the derived counters)
 * per sample — never a query string or payload (no-PII rule).
 */
interface ProviderHealthRecord {
  buffer: RingBuffer<HealthSample>;
  lastSuccessAt: number | null;
  lastSuccessfulDataRetrievalAt: number | null;
  consecutiveFailures: number;
  consecutiveEmptyResults: number;
  lastErrorDetail: string | null;
}

export interface RecordOptions {
  newestObservationAt?: number;
  oldestObservationAt?: number;
  errorDetail?: string;
}

export class HealthTracker {
  private readonly providers = new Map<string, ProviderHealthRecord>();

  /**
   * Record one probe result for a provider. `not_found` (no adapter
   * registered) is excluded entirely (HEALTH-07): it touches neither the
   * windowed buffer nor either independent field.
   */
  record(
    providerId: string,
    status: 'ok' | 'empty' | 'error' | 'not_found',
    latencyMs: number,
    timestamp: number = Date.now(),
    opts?: RecordOptions
  ): void {
    const outcome = classifyOutcome(status);
    if (outcome === null) return; // not_found: not a health signal, do not record

    let record = this.providers.get(providerId);
    if (!record) {
      record = { 
        buffer: new RingBuffer<HealthSample>(HEALTH_WINDOW), 
        lastSuccessAt: null, 
        lastSuccessfulDataRetrievalAt: null,
        consecutiveFailures: 0,
        consecutiveEmptyResults: 0,
        lastErrorDetail: null
      };
      this.providers.set(providerId, record);
    }

    record.buffer.push({
      outcome,
      status,
      latencyMs: outcome === 'up' ? latencyMs : null,
      timestamp,
      newestObservationAt: opts?.newestObservationAt,
      oldestObservationAt: opts?.oldestObservationAt,
      errorDetail: opts?.errorDetail,
    });

    if (outcome === 'up') {
      record.lastSuccessAt = timestamp;
      record.consecutiveFailures = 0;
      record.lastErrorDetail = null;

      if (status === 'ok') {
        record.lastSuccessfulDataRetrievalAt = timestamp;
        record.consecutiveEmptyResults = 0;
      } else if (status === 'empty') {
        record.consecutiveEmptyResults += 1;
      }
    } else {
      record.consecutiveFailures += 1;
      record.lastErrorDetail = opts?.errorDetail || null;
      // lastSuccessAt intentionally left unchanged.
    }
  }

  /** Windowed samples for a provider, oldest first; [] when never recorded (warming up). */
  samples(providerId: string): HealthSample[] {
    return this.providers.get(providerId)?.buffer.toArray() ?? [];
  }

  /** Independent last-success timestamp; null when the provider has never been up. */
  lastSuccessAt(providerId: string): number | null {
    return this.providers.get(providerId)?.lastSuccessAt ?? null;
  }

  /** Independent last-successful-data timestamp; null when never returned data. */
  lastSuccessfulDataRetrievalAt(providerId: string): number | null {
    return this.providers.get(providerId)?.lastSuccessfulDataRetrievalAt ?? null;
  }

  /** Independent, unbounded consecutive-failure count; 0 when unknown or never failed. */
  consecutiveFailures(providerId: string): number {
    return this.providers.get(providerId)?.consecutiveFailures ?? 0;
  }

  /** Derive the semantic ProviderStatus from current metrics. */
  deriveStatus(providerId: string): ProviderStatus {
    const record = this.providers.get(providerId);
    if (!record || record.buffer.toArray().length === 0) return 'UNKNOWN';

    if (record.consecutiveFailures >= DOWN_THRESHOLD) return 'UNAVAILABLE';
    
    // If it's failing but hasn't reached DOWN threshold, it's degraded
    if (record.consecutiveFailures > 0) return 'DEGRADED';

    // If it's returning empty results continuously for a large number of probes (e.g. 5)
    if (record.consecutiveEmptyResults >= 5) return 'DEGRADED';

    return 'HEALTHY';
  }
}
