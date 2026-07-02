import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildEonetUrl, fetchEonetEvents } from '../service.js';
import { EonetCache } from '../cache.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/events.json'), 'utf8'),
);

function deps(fetchImpl: ReturnType<typeof vi.fn>) {
  return { cache: new EonetCache(), fetchJson: fetchImpl as never };
}

describe('buildEonetUrl — param whitelist + validation', () => {
  it('defaults status to all', () => {
    expect(buildEonetUrl()).toContain('status=all');
  });

  it('keeps a valid status and drops an invalid one', () => {
    expect(buildEonetUrl({ status: 'closed' })).toContain('status=closed');
    expect(buildEonetUrl({ status: 'bogus' })).toContain('status=all');
  });

  it('forwards a valid bbox and drops a malformed one', () => {
    expect(buildEonetUrl({ bbox: '-73.4,12.2,-59.8,0.6' })).toContain(
      'bbox=-73.4%2C12.2%2C-59.8%2C0.6',
    );
    expect(buildEonetUrl({ bbox: '1,2,3' })).not.toContain('bbox=');
    expect(buildEonetUrl({ bbox: 'a,b,c,d' })).not.toContain('bbox=');
  });

  it('forwards YYYY-MM-DD dates only', () => {
    expect(buildEonetUrl({ start: '2026-01-01', end: '2026-12-31' })).toContain(
      'start=2026-01-01',
    );
    expect(buildEonetUrl({ start: 'nope' })).not.toContain('start=');
  });

  it('drops unknown categories and never forwards earthquakes', () => {
    expect(buildEonetUrl({ category: 'floods,wildfires' })).toContain(
      'category=floods%2Cwildfires',
    );
    expect(buildEonetUrl({ category: 'earthquakes' })).not.toContain('category=');
    expect(buildEonetUrl({ category: 'floods,earthquakes' })).toContain(
      'category=floods',
    );
    expect(buildEonetUrl({ category: 'floods,earthquakes' })).not.toContain(
      'earthquakes',
    );
    expect(buildEonetUrl({ category: 'notacat' })).not.toContain('category=');
  });
});

describe('fetchEonetEvents — live path', () => {
  it('normalizes and sorts the fixture, reporting source=live', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const result = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, deps(fetchJson));

    expect(result.source).toBe('live');
    expect(result.collection.type).toBe('FeatureCollection');
    expect(result.collection.features.map((f) => f.properties.id)).toEqual([
      'SYN_FLOOD_01',
      'SYN_WILDFIRE_03',
      'SYN_STORM_02',
    ]);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});

describe('fetchEonetEvents — caching', () => {
  it('serves a second identical in-TTL request from cache without re-fetching', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const shared = deps(fetchJson);

    const first = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    const second = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);

    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(second.collection).toEqual(first.collection);
  });
});

describe('fetchEonetEvents — graceful degradation', () => {
  it('degrades to stale cache when EONET fails after a prior success', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(fixture)
      .mockRejectedValueOnce(new Error('EONET down'));
    // Force expiry so the second call is a fresh miss that must fetch and fail.
    const shared = { cache: new EonetCache({ ttlMs: -1 }), fetchJson: fetchJson as never };

    const first = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);
    const second = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, shared);

    expect(first.source).toBe('live');
    expect(second.source).toBe('cache'); // stale served
    expect(second.collection).toEqual(first.collection);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('returns an empty FeatureCollection (source=empty) when EONET fails with no cache', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('EONET down'));
    const result = await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, deps(fetchJson));

    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, deps(fetchJson)),
    ).resolves.toBeDefined();
  });

  it('requests the correct URL (status=all, whitelisted bbox)', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    await fetchEonetEvents({ bbox: '-73.4,12.2,-59.8,0.6' }, deps(fetchJson));
    const calledUrl = fetchJson.mock.calls[0][0] as string;
    expect(calledUrl).toContain('https://eonet.gsfc.nasa.gov/api/v3/events');
    expect(calledUrl).toContain('status=all');
  });
});
