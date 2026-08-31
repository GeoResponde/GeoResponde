/**
 * Health data model shared across the metrics core (Phase 17), the future
 * `/api/dev/health` endpoint (Phase 18), and the dashboard renderer
 * (Phase 19). Defines the two-state outcome a probe collapses into, the
 * per-sample shape recorded in the windowed history, and the classification
 * gate that decides whether a probe result becomes a health signal at all.
 *
 * No PII: a HealthSample stores only `outcome`, `latencyMs`, and `timestamp`
 * — never a query string, payload, or any provider response body.
 */

export type ProviderStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';

/** Collapsed two-state outcome a classified probe result maps onto. */
export type HealthOutcome = 'up' | 'down';

/**
 * One recorded health check. `latencyMs` is null for DOWN samples — an
 * errored probe never completes a timed response. `timestamp` is epoch ms.
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
 * Tunable defaults from the approved health-dashboard proposal.
 * HEALTH_WINDOW: size of the rolling per-provider sample window (HEALTH-04).
 * DOWN_THRESHOLD: consecutive-failure count considered "down" for badge
 * rendering purposes in a later phase (HEALTH-06).
 */
export const HEALTH_WINDOW = 20;
export const DOWN_THRESHOLD = 3;

/**
 * Single chokepoint implementing the HEALTH-07 exclusion: `ok` and `empty`
 * (reachable, whether or not it found matches) both count as UP; `error`
 * counts as DOWN; `not_found` (no adapter registered for the provider) is
 * not a health signal at all and returns null so callers know not to record
 * it — it must never touch the windowed buffer or the tracker's counters.
 */
export function classifyOutcome(status: 'ok' | 'empty' | 'error' | 'not_found'): HealthOutcome | null {
  switch (status) {
    case 'ok':
    case 'empty':
      return 'up';
    case 'error':
      return 'down';
    case 'not_found':
      return null;
  }
}
