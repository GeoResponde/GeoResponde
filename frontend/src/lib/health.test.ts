import { describe, it, expect } from 'vitest';
import {
  formatAvailability,
  buildSparkline,
  type ProviderHealthSnapshot,
  type HealthSample,
} from './health';

function sample(outcome: 'up' | 'down', latencyMs: number | null, timestamp = 0): HealthSample {
  return { outcome, status: outcome === 'up' ? 'ok' : 'error', latencyMs, timestamp };
}

function snapshot(overrides: Partial<ProviderHealthSnapshot>): ProviderHealthSnapshot {
  return {
    providerStatus: 'UNKNOWN',
    averageLatencyMs: null,
    lastSuccessAt: null,
    lastSuccessfulDataRetrievalAt: null,
    consecutiveFailures: 0,
    lastErrorDetail: null,
    samples: [],
    up: 0,
    total: 0,
    ...overrides,
  };
}

describe('formatAvailability', () => {
  it('formats up=17/total=18 as "94% (17/18)"', () => {
    expect(formatAvailability(snapshot({ up: 17, total: 18 }))).toBe('94% (17/18)');
  });

  it('formats up=170/total=180 as "94% (170/180)" (sample size shown)', () => {
    expect(formatAvailability(snapshot({ up: 170, total: 180 }))).toBe('94% (170/180)');
  });

  it('returns the warming token for total === 0 (never "100%", never NaN/Infinity)', () => {
    const result = formatAvailability(snapshot({ up: 0, total: 0 }));
    expect(result).toBe('warming');
    expect(result).not.toContain('%');
  });

  it('formats up=0/total=3 as "0% (0/3)"', () => {
    expect(formatAvailability(snapshot({ up: 0, total: 3 }))).toBe('0% (0/3)');
  });
});

describe('buildSparkline', () => {
  const opts = { width: 100, height: 30, padding: 2 };

  it('returns empty points and empty markers for empty samples', () => {
    const result = buildSparkline([], opts);
    expect(result.points).toBe('');
    expect(result.markers).toEqual([]);
  });

  it('returns one point for a single up sample (degenerate but valid)', () => {
    const result = buildSparkline([sample('up', 100, 1)], opts);
    expect(result.points.trim().length).toBeGreaterThan(0);
    expect(result.points.trim().split(' ').length).toBe(1);
    expect(result.markers).toEqual([]);
  });

  it('excludes DOWN samples (null latency) from the polyline and emits baseline markers instead', () => {
    const result = buildSparkline(
      [sample('up', 100, 1), sample('down', null, 2), sample('up', 120, 3)],
      opts,
    );
    // polyline only has the two up points
    expect(result.points.trim().split(' ').length).toBe(2);
    // one baseline marker for the down sample
    expect(result.markers.length).toBe(1);
    expect(result.markers[0].y).toBe(opts.height - opts.padding);
  });

  it('returns an empty polyline and N baseline markers for an all-down window', () => {
    const samples = [sample('down', null, 1), sample('down', null, 2), sample('down', null, 3)];
    const result = buildSparkline(samples, opts);
    expect(result.points).toBe('');
    expect(result.markers.length).toBe(3);
  });

  it('never emits a NaN/non-finite coordinate for a non-finite latency (T-19-01)', () => {
    const samples = [sample('up', Number.NaN, 1), sample('up', 100, 2)];
    const result = buildSparkline(samples, opts);
    expect(result.points).not.toMatch(/NaN/);
    expect(result.points).not.toMatch(/Infinity/);
  });

  it('maps samples oldest-first (chronological left-to-right x-axis)', () => {
    // samples arrive oldest-first (RingBuffer.toArray order); x should increase with index
    const result = buildSparkline([sample('up', 50, 1), sample('up', 200, 2)], opts);
    const points = result.points.trim().split(' ').map((p) => p.split(',').map(Number));
    expect(points[0][0]).toBeLessThan(points[1][0]);
  });
});
