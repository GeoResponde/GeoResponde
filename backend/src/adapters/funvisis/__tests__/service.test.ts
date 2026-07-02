import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fetchFunvisisEarthquakes } from '../service.js';
import { FunvisisCache } from '../cache.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/sismos.json'), 'utf8'),
);

function deps(fetchImpl: ReturnType<typeof vi.fn>) {
  return { cache: new FunvisisCache(), fetchJson: fetchImpl as never };
}

describe('fetchFunvisisEarthquakes — live path', () => {
  it('normalizes the fixture and reports source=live', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const result = await fetchFunvisisEarthquakes({}, deps(fetchJson));
    expect(result.source).toBe('live');
    expect(result.collection.features).toHaveLength(2);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson.mock.calls[0][0]).toContain('sismosve.rafnixg.dev/api/sismos');
  });
});

describe('fetchFunvisisEarthquakes — start window filter', () => {
  it('filters out events before the start cutoff', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    // syn_fv_002 is 2026-05-15; a 2026-06-01 cutoff drops it.
    const result = await fetchFunvisisEarthquakes({ start: '2026-06-01' }, deps(fetchJson));
    expect(result.collection.features.map((f) => f.properties.id)).toEqual(['syn_fv_001']);
  });

  it('shares one upstream fetch across different windows via cache', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const shared = deps(fetchJson);
    await fetchFunvisisEarthquakes({ start: '2026-01-01' }, shared);
    const second = await fetchFunvisisEarthquakes({ start: '2026-06-01' }, shared);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(second.source).toBe('cache');
    expect(second.collection.features).toHaveLength(1);
  });
});

describe('fetchFunvisisEarthquakes — graceful degradation', () => {
  it('degrades to stale cache after a prior success', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(fixture)
      .mockRejectedValueOnce(new Error('SismosVE down'));
    const shared = { cache: new FunvisisCache({ ttlMs: -1 }), fetchJson: fetchJson as never };
    const first = await fetchFunvisisEarthquakes({}, shared);
    const second = await fetchFunvisisEarthquakes({}, shared);
    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
  });

  it('returns empty (source=empty) when SismosVE fails with no cache', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('SismosVE down'));
    const result = await fetchFunvisisEarthquakes({}, deps(fetchJson));
    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(fetchFunvisisEarthquakes({}, deps(fetchJson))).resolves.toBeDefined();
  });
});
