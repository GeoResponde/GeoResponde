import { describe, it, expect } from 'vitest';
import { HealthTracker } from '../HealthTracker.js';
import { HEALTH_WINDOW } from '../types.js';

describe('HealthTracker', () => {
  it('records an UP sample and sets lastSuccessAt / resets consecutiveFailures on ok/empty', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 120, 1000);
    expect(tracker.samples('provA')).toEqual([{ outcome: 'up', status: 'ok', latencyMs: 120, timestamp: 1000, errorDetail: undefined, newestObservationAt: undefined, oldestObservationAt: undefined }]);
    expect(tracker.lastSuccessAt('provA')).toBe(1000);
    expect(tracker.consecutiveFailures('provA')).toBe(0);

    tracker.record('provA', 'empty', 80, 2000);
    expect(tracker.samples('provA')).toHaveLength(2);
    expect(tracker.lastSuccessAt('provA')).toBe(2000);
  });

  it('records a DOWN sample with null latency, increments failures, leaves lastSuccessAt unchanged', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 100, 1000);
    tracker.record('provA', 'error', 999, 2000);
    expect(tracker.samples('provA')).toEqual([
      { outcome: 'up', status: 'ok', latencyMs: 100, timestamp: 1000, errorDetail: undefined, newestObservationAt: undefined, oldestObservationAt: undefined },
      { outcome: 'down', status: 'error', latencyMs: null, timestamp: 2000, errorDetail: undefined, newestObservationAt: undefined, oldestObservationAt: undefined },
    ]);
    expect(tracker.consecutiveFailures('provA')).toBe(1);
    expect(tracker.lastSuccessAt('provA')).toBe(1000);
  });

  it('records nothing for not_found (HEALTH-07 exclusion end-to-end)', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'not_found', 0, 1000);
    expect(tracker.samples('provA')).toEqual([]);
    expect(tracker.lastSuccessAt('provA')).toBeNull();
    expect(tracker.consecutiveFailures('provA')).toBe(0);
  });

  it('keeps independent history and counters across providers', () => {
    const tracker = new HealthTracker();
    tracker.record('A', 'ok', 100, 1000);
    tracker.record('B', 'error', 0, 1000);
    tracker.record('B', 'error', 0, 2000);

    expect(tracker.samples('A')).toHaveLength(1);
    expect(tracker.lastSuccessAt('A')).toBe(1000);
    expect(tracker.consecutiveFailures('A')).toBe(0);

    expect(tracker.samples('B')).toHaveLength(2);
    expect(tracker.lastSuccessAt('B')).toBeNull();
    expect(tracker.consecutiveFailures('B')).toBe(2);
  });

  it('keeps only the last HEALTH_WINDOW samples in the windowed buffer on overflow', () => {
    const tracker = new HealthTracker();
    for (let i = 0; i < HEALTH_WINDOW + 5; i++) {
      tracker.record('provA', 'ok', 10, i);
    }
    expect(tracker.samples('provA').length).toBe(HEALTH_WINDOW);
  });

  it('BLOCKER-FIX: lastSuccessAt persists and consecutiveFailures is not capped by window truncation', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 50, 1000); // T
    for (let i = 0; i < 25; i++) {
      tracker.record('provA', 'error', 0, 2000 + i);
    }
    // The UP sample was evicted from the 20-cap windowed buffer...
    expect(tracker.samples('provA').every((s) => s.outcome === 'down')).toBe(true);
    // ...but the independent field still holds it.
    expect(tracker.lastSuccessAt('provA')).toBe(1000);
    // Consecutive failures is a true unbounded streak, not window-truncated.
    expect(tracker.consecutiveFailures('provA')).toBe(25);
  });

  it('returns warming-up defaults for an unknown provider', () => {
    const tracker = new HealthTracker();
    expect(tracker.samples('unknown')).toEqual([]);
    expect(tracker.lastSuccessAt('unknown')).toBeNull();
    expect(tracker.consecutiveFailures('unknown')).toBe(0);
  });
});
