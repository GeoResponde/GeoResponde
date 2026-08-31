import { describe, it, expect, vi } from 'vitest';
import { HealthTracker } from '../HealthTracker.js';
import {
  HealthProbeService,
  HEALTH_PROBE_QUERY,
  THROTTLE_MS,
  mapInspectToStatus,
  assembleSnapshot,
  type InspectResult,
} from '../HealthProbeService.js';

describe('mapInspectToStatus', () => {
  it('maps ok with results to ok', () => {
    expect(mapInspectToStatus({ status: 'ok', normalizedResults: 3 })).toBe('ok');
  });

  it('maps ok with zero results to empty (reachable, HEALTH-07 UP)', () => {
    expect(mapInspectToStatus({ status: 'ok', normalizedResults: 0 })).toBe('empty');
  });

  it('maps error to error', () => {
    expect(mapInspectToStatus({ status: 'error' })).toBe('error');
  });

  it('maps not_found to not_found', () => {
    expect(mapInspectToStatus({ status: 'not_found' })).toBe('not_found');
  });
});

describe('assembleSnapshot', () => {
  it('returns warming-up defaults for a never-probed provider', () => {
    const tracker = new HealthTracker();
    const snapshot = assembleSnapshot(tracker, 'provA');
    expect(snapshot).toEqual({
      providerStatus: 'UNKNOWN',
      averageLatencyMs: null,
      lastSuccessAt: null,
      lastSuccessfulDataRetrievalAt: null,
      consecutiveFailures: 0,
      lastErrorDetail: null,
      samples: [],
      up: 0,
      total: 0,
    });
  });

  it('assembles from tracker-recorded samples: windowed samples, up/total, tracker-sourced counters', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 100, 1000);
    tracker.record('provA', 'error', 0, 2000);
    tracker.record('provA', 'ok', 200, 3000);

    const snapshot = assembleSnapshot(tracker, 'provA');
    expect(snapshot.samples).toHaveLength(3);
    expect(snapshot.up).toBe(2);
    expect(snapshot.total).toBe(3);
    expect(snapshot.averageLatencyMs).toBe(150);
    expect(snapshot.lastSuccessAt).toBe(3000);
    expect(snapshot.consecutiveFailures).toBe(0);
  });

  it('lastSuccessAt/consecutiveFailures survive a failure streak longer than the window', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 50, 1000);
    for (let i = 0; i < 25; i++) {
      tracker.record('provA', 'error', 0, 2000 + i);
    }
    const snapshot = assembleSnapshot(tracker, 'provA');
    expect(snapshot.samples.every((s) => s.outcome === 'down')).toBe(true);
    expect(snapshot.lastSuccessAt).toBe(1000);
    expect(snapshot.consecutiveFailures).toBe(25);
  });

  it('never includes query/sample/payload/error fields (no-PII)', () => {
    const tracker = new HealthTracker();
    tracker.record('provA', 'ok', 100, 1000);
    const snapshot = assembleSnapshot(tracker, 'provA');
    expect(Object.keys(snapshot).sort()).toEqual(
      ['averageLatencyMs', 'consecutiveFailures', 'lastErrorDetail', 'lastSuccessAt', 'lastSuccessfulDataRetrievalAt', 'providerStatus', 'samples', 'total', 'up'].sort()
    );
    expect(JSON.stringify(snapshot)).not.toContain(HEALTH_PROBE_QUERY);
  });
});

describe('HealthProbeService', () => {
  function makeClock(start = 0) {
    let current = start;
    return {
      now: () => current,
      advance: (ms: number) => {
        current += ms;
      },
    };
  }

  it('probes a never-probed provider on first probeAll', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'ok', normalizedResults: 1, elapsedMs: 10 }));
    const clock = makeClock();
    const service = new HealthProbeService({ tracker, probe, now: clock.now });

    await service.probeAll(['p1']);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('p1', HEALTH_PROBE_QUERY);
  });

  it('throttle skip: a second probeAll within THROTTLE_MS does not re-probe', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'ok', normalizedResults: 1, elapsedMs: 10 }));
    const clock = makeClock();
    const service = new HealthProbeService({ tracker, probe, now: clock.now });

    await service.probeAll(['p1']);
    clock.advance(THROTTLE_MS - 1);
    const result = await service.probeAll(['p1']);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(result.p1.total).toBe(1);
  });

  it('throttle allow: probeAll after THROTTLE_MS has elapsed probes again', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'ok', normalizedResults: 1, elapsedMs: 10 }));
    const clock = makeClock();
    const service = new HealthProbeService({ tracker, probe, now: clock.now });

    await service.probeAll(['p1']);
    clock.advance(THROTTLE_MS);
    await service.probeAll(['p1']);

    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('records up sample with elapsedMs latency for ok with results', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'ok', normalizedResults: 2, elapsedMs: 120 }));
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    await service.probeAll(['p1']);
    expect(tracker.samples('p1')).toEqual([{ outcome: 'up', status: 'ok', latencyMs: 120, timestamp: 0, newestObservationAt: undefined, oldestObservationAt: undefined, errorDetail: undefined }]);
  });

  it('records up sample for ok with zero results (empty)', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'ok', normalizedResults: 0, elapsedMs: 50 }));
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    await service.probeAll(['p1']);
    const samples = tracker.samples('p1');
    expect(samples).toHaveLength(1);
    expect(samples[0].outcome).toBe('up');
  });

  it('records down sample for error', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'error', elapsedMs: 80 }));
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    await service.probeAll(['p1']);
    const samples = tracker.samples('p1');
    expect(samples).toHaveLength(1);
    expect(samples[0].outcome).toBe('down');
  });

  it('not_found excluded: records nothing but probeAll still resolves without throwing', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => ({ status: 'not_found' }));
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    const result = await service.probeAll(['p1']);
    expect(tracker.samples('p1')).toEqual([]);
    expect(result.p1).toEqual({
      providerStatus: 'UNKNOWN',
      averageLatencyMs: null,
      lastSuccessAt: null,
      lastSuccessfulDataRetrievalAt: null,
      consecutiveFailures: 0,
      lastErrorDetail: null,
      samples: [],
      up: 0,
      total: 0,
    });
  });

  it('throw -> DOWN: a throwing probe fn is recorded as down and probeAll never rejects', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (): Promise<InspectResult> => {
      throw new Error('upstream exploded');
    });
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    await expect(service.probeAll(['p1'])).resolves.toBeDefined();
    const samples = tracker.samples('p1');
    expect(samples).toHaveLength(1);
    expect(samples[0].outcome).toBe('down');
  });

  it('stampede guard: two concurrent probeAll calls for the same provider probe only once', async () => {
    const tracker = new HealthTracker();
    let resolveProbe!: (v: InspectResult) => void;
    const probe = vi.fn(
      () =>
        new Promise<InspectResult>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    const call1 = service.probeAll(['p1']);
    const call2 = service.probeAll(['p1']);

    expect(probe).toHaveBeenCalledTimes(1);
    resolveProbe({ status: 'ok', normalizedResults: 1, elapsedMs: 10 });

    const [result1, result2] = await Promise.all([call1, call2]);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(result1.p1).toEqual(result2.p1);
  });

  it('probes multiple providers independently; one throw/skip never blocks the other', async () => {
    const tracker = new HealthTracker();
    const probe = vi.fn(async (id: string): Promise<InspectResult> => {
      if (id === 'bad') throw new Error('down');
      return { status: 'ok', normalizedResults: 1, elapsedMs: 10 };
    });
    const service = new HealthProbeService({ tracker, probe, now: makeClock().now });

    const result = await service.probeAll(['good', 'bad']);
    expect(result.good.up).toBe(1);
    expect(tracker.samples('bad')[0].outcome).toBe('down');
  });
});
