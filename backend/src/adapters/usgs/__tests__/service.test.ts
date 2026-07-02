import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildUsgsUrl, fetchUsgsEarthquakes } from '../service.js';
import { UsgsCache } from '../cache.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/query.json'), 'utf8'),
);

function deps(fetchImpl: ReturnType<typeof vi.fn>) {
  return { cache: new UsgsCache(), fetchJson: fetchImpl as never };
}

describe('buildUsgsUrl — param whitelist + validation', () => {
  it('always requests format=geojson', () => {
    expect(buildUsgsUrl()).toContain('format=geojson');
  });

  it('transposes a [W,N,E,S] registry bbox to USGS min/max lat/lon', () => {
    const url = buildUsgsUrl({ bbox: '-73.4,12.2,-59.8,0.6' });
    expect(url).toContain('minlongitude=-73.4');
    expect(url).toContain('maxlatitude=12.2');
    expect(url).toContain('maxlongitude=-59.8');
    expect(url).toContain('minlatitude=0.6');
  });

  it('drops a malformed bbox', () => {
    expect(buildUsgsUrl({ bbox: '1,2,3' })).not.toContain('minlatitude=');
    expect(buildUsgsUrl({ bbox: 'a,b,c,d' })).not.toContain('minlatitude=');
  });

  it('forwards YYYY-MM-DD starttime only', () => {
    expect(buildUsgsUrl({ start: '2026-06-24' })).toContain('starttime=2026-06-24');
    expect(buildUsgsUrl({ start: 'nope' })).not.toContain('starttime=');
  });
});

describe('fetchUsgsEarthquakes — live path', () => {
  it('normalizes the fixture and reports source=live', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const result = await fetchUsgsEarthquakes(
      { bbox: '-73.4,12.2,-59.8,0.6' },
      deps(fetchJson),
    );
    expect(result.source).toBe('live');
    expect(result.collection.features).toHaveLength(3);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});

describe('fetchUsgsEarthquakes — caching', () => {
  it('serves a second identical in-TTL request from cache', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const shared = deps(fetchJson);
    const first = await fetchUsgsEarthquakes({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    const second = await fetchUsgsEarthquakes({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});

describe('fetchUsgsEarthquakes — graceful degradation', () => {
  it('degrades to stale cache after a prior success', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(fixture)
      .mockRejectedValueOnce(new Error('USGS down'));
    const shared = { cache: new UsgsCache({ ttlMs: -1 }), fetchJson: fetchJson as never };
    const first = await fetchUsgsEarthquakes({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    const second = await fetchUsgsEarthquakes({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
  });

  it('returns empty (source=empty) when USGS fails with no cache', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('USGS down'));
    const result = await fetchUsgsEarthquakes(
      { bbox: '-73.4,12.2,-59.8,0.6' },
      deps(fetchJson),
    );
    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      fetchUsgsEarthquakes({ bbox: '-73.4,12.2,-59.8,0.6' }, deps(fetchJson)),
    ).resolves.toBeDefined();
  });
});
