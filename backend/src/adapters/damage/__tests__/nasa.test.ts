import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  isAllowedArcgisUrl,
  parseBboxParam,
  bboxToEnvelope,
  buildDpmQueryUrl,
  mergeArcgisPages,
  fetchNasaDpm,
} from '../nasa.js';
import { DamageCache } from '../cache.js';

const page1 = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/nasa-dpm-page1.json'), 'utf8'),
);
const page2 = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/nasa-dpm-page2.json'), 'utf8'),
);

const DPM_BASE =
  'https://services7.arcgis.com/WSiUmUhlFx4CtMBB/arcgis/rest/services/202610_s1_likelydmgareas/FeatureServer/0';

/**
 * A fetchJson stub that routes by the OID cursor in the `where` clause: the first
 * page (`fid>-1`) returns the 3-feature page1 (a "full" page at pageSize=3), and
 * the follow-up (`fid>3`, the last fid of page1) returns the 1-feature page2 (the
 * short final page that ends pagination).
 */
function routedFetch() {
  return vi.fn(async (url: string) => {
    const where = new URL(url).searchParams.get('where') ?? '';
    return where.includes('fid>-1') ? page1 : page2;
  });
}

function deps(fetchImpl: ReturnType<typeof vi.fn>, cache = new DamageCache(), pageSize = 3) {
  return { cache, fetchJson: fetchImpl as never, pageSize };
}

// --- Task 1: pure helpers -------------------------------------------------

describe('isAllowedArcgisUrl — SSRF allowlist', () => {
  it('accepts only https on services7.arcgis.com', () => {
    expect(isAllowedArcgisUrl(DPM_BASE)).toBe(true);
    expect(isAllowedArcgisUrl(`${DPM_BASE}/query`)).toBe(true);
  });

  it('rejects http, other hosts, non-strings and garbage', () => {
    expect(isAllowedArcgisUrl('http://services7.arcgis.com/x')).toBe(false);
    expect(isAllowedArcgisUrl('https://evil.example.com/x')).toBe(false);
    expect(isAllowedArcgisUrl('https://services8.arcgis.com/x')).toBe(false);
    expect(isAllowedArcgisUrl('not a url')).toBe(false);
    expect(isAllowedArcgisUrl(42)).toBe(false);
    expect(isAllowedArcgisUrl(null)).toBe(false);
    expect(isAllowedArcgisUrl(undefined)).toBe(false);
  });
});

describe('parseBboxParam — untrusted ?bbox validation', () => {
  it('returns a tuple only for exactly four finite numbers', () => {
    expect(parseBboxParam('-73.4,0.6,-59.8,12.2')).toEqual([-73.4, 0.6, -59.8, 12.2]);
  });

  it('rejects wrong count, non-numeric, NaN/Infinity and non-strings', () => {
    expect(parseBboxParam('1,2,3')).toBeUndefined();
    expect(parseBboxParam('1,2,3,4,5')).toBeUndefined();
    expect(parseBboxParam('a,b,c,d')).toBeUndefined();
    expect(parseBboxParam('1,2,3,Infinity')).toBeUndefined();
    expect(parseBboxParam('1,2,3,NaN')).toBeUndefined();
    expect(parseBboxParam(1234 as unknown)).toBeUndefined();
    expect(parseBboxParam(undefined)).toBeUndefined();
  });
});

describe('bboxToEnvelope — COUNTRY_BBOX (W,N,E,S) -> ArcGIS envelope (W,S,E,N)', () => {
  it('reorders the VE tuple correctly (ND-03)', () => {
    expect(bboxToEnvelope([-73.4, 12.2, -59.8, 0.6])).toBe('-73.4,0.6,-59.8,12.2');
  });
});

describe('buildDpmQueryUrl — filtered + cursor-paginated query builder', () => {
  it('emits where=damage=1 AND fid>cursor + f=geojson + orderByFields=fid + resultRecordCount by default (no geometry)', () => {
    const url = buildDpmQueryUrl(DPM_BASE, {
      where: 'damage=1',
      outFields: 'damage_probability,label',
      cursor: 4321,
    });
    expect(url).toBeDefined();
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname.endsWith('/query')).toBe(true);
    // The mandatory damage=1 filter PLUS the ascending OID cursor (ND-03).
    expect(params.get('where')).toBe('damage=1 AND fid>4321');
    // Default path omits the spatial envelope — it times out on this hosted layer.
    expect(params.get('geometry')).toBeNull();
    expect(params.get('geometryType')).toBeNull();
    // The OID field is ensured in outFields so the next cursor is readable.
    expect(params.get('outFields')).toBe('damage_probability,label,fid');
    expect(params.get('f')).toBe('geojson');
    expect(params.get('orderByFields')).toBe('fid');
    expect(params.get('resultRecordCount')).toBe('2000');
    // Deep resultOffset is intentionally NOT used (it scans + times out).
    expect(params.get('resultOffset')).toBeNull();
  });

  it('starts pagination from the layer start when cursor is -1', () => {
    const url = buildDpmQueryUrl(DPM_BASE, {
      where: 'damage=1',
      outFields: 'fid,damage_probability,label',
      cursor: -1,
    });
    const params = new URL(url!).searchParams;
    expect(params.get('where')).toBe('damage=1 AND fid>-1');
    // Does not duplicate fid when already present in outFields.
    expect(params.get('outFields')).toBe('fid,damage_probability,label');
  });

  it('sanitizes a non-finite cursor to -1 (no injection)', () => {
    const url = buildDpmQueryUrl(DPM_BASE, {
      where: 'damage=1',
      outFields: 'fid',
      cursor: Number.NaN,
    });
    expect(new URL(url!).searchParams.get('where')).toBe('damage=1 AND fid>-1');
  });

  it('adds the spatial envelope params only when an envelope is supplied (opt-in ?bbox)', () => {
    const url = buildDpmQueryUrl(DPM_BASE, {
      where: 'damage=1',
      outFields: 'damage_probability,label',
      envelope: '-73.4,0.6,-59.8,12.2',
      cursor: -1,
    });
    const params = new URL(url!).searchParams;
    expect(params.get('geometry')).toBe('-73.4,0.6,-59.8,12.2');
    expect(params.get('geometryType')).toBe('esriGeometryEnvelope');
    expect(params.get('inSR')).toBe('4326');
    expect(params.get('spatialRel')).toBe('esriSpatialRelIntersects');
  });

  it('does not double-append /query when already present', () => {
    const url = buildDpmQueryUrl(`${DPM_BASE}/query`, {
      where: 'damage=1',
      outFields: '*',
      cursor: -1,
    });
    expect(url!.match(/\/query/g)).toHaveLength(1);
  });

  it('rejects a baseUrl failing the ArcGIS allowlist', () => {
    expect(
      buildDpmQueryUrl('https://evil.example.com/x', {
        where: 'damage=1',
        outFields: '*',
        cursor: -1,
      }),
    ).toBeUndefined();
  });
});

describe('mergeArcgisPages — pass-through + merge', () => {
  it('concatenates features across pages, passing properties through untouched', () => {
    const merged = mergeArcgisPages([page1, page2]);
    expect(merged.type).toBe('FeatureCollection');
    expect(merged.features).toHaveLength(4);
    const props = merged.features.map(
      (f) => (f as { properties: Record<string, unknown> }).properties,
    );
    expect(props).toContainEqual({ fid: 1, damage_probability: 0.9, label: 'damaged' });
  });

  it('drops junk pages and never throws', () => {
    expect(() => mergeArcgisPages([null, 'garbage', 42, {}])).not.toThrow();
    expect(mergeArcgisPages([null, 'garbage']).features).toHaveLength(0);
  });
});

// --- Task 2: fetchNasaDpm service ----------------------------------------

describe('fetchNasaDpm — live, filtered, paginated', () => {
  it('paginates the filtered DPM query and merges pages, source live', async () => {
    const fetchJson = routedFetch();
    const result = await fetchNasaDpm({}, deps(fetchJson));

    expect(result.source).toBe('live');
    expect(result.collection.features).toHaveLength(4); // 3 (page1) + 1 (page2)
    expect(result.attribution).toContain('NASA-JPL');
    expect(result.disclaimer).toContain('Experimental');
    // page1 (full, 3==pageSize) then page2 (short) => exactly 2 fetches
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('always sends where=damage=1 + resultRecordCount on every fetched url (ND-03)', async () => {
    const fetchJson = routedFetch();
    await fetchNasaDpm({}, deps(fetchJson));
    for (const call of fetchJson.mock.calls) {
      const url = call[0] as string;
      expect(url).toContain('where=damage%3D1');
      expect(url).toContain('resultRecordCount=');
      expect(isAllowedArcgisUrl(url.split('?')[0])).toBe(true);
    }
  });

  it('caps pagination at the hard page cap when every page is full (DoS backstop)', async () => {
    // Always return a FULL page whose fids strictly advance past the cursor, so the
    // loop never sees a short page and never stalls — only the hard cap stops it.
    const fetchJson = vi.fn(async (url: string) => {
      const where = new URL(url).searchParams.get('where') ?? '';
      const base = Number(where.match(/fid>(-?\d+)/)?.[1] ?? -1) + 1;
      return {
        type: 'FeatureCollection',
        features: [0, 1, 2].map((i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { fid: base + i, damage_probability: 0.5, label: 'damaged' },
        })),
      };
    });
    const result = await fetchNasaDpm({}, deps(fetchJson));
    expect(result.source).toBe('live');
    expect(fetchJson.mock.calls.length).toBe(40); // hard page cap
  });

  it('caches a fresh in-TTL second identical call without re-querying ArcGIS', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    const first = await fetchNasaDpm({}, shared);
    const second = await fetchNasaDpm({}, shared);
    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
    expect(second.collection).toEqual(first.collection);
    expect(fetchJson).toHaveBeenCalledTimes(2); // only the first call hit the network
  });

  it('caches a ?bbox override separately from the country-bbox default', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await fetchNasaDpm({}, shared); // country bbox
    const override = await fetchNasaDpm({ bbox: '-70,9,-66,11' }, shared);
    expect(override.source).toBe('live'); // different cache key => re-queried
    // the override envelope is joined as-is (already ArcGIS order)
    const overrideUrls = fetchJson.mock.calls
      .map((c) => c[0] as string)
      .filter((u) => u.includes('geometry=-70'));
    expect(overrideUrls.length).toBeGreaterThan(0);
  });
});

describe('fetchNasaDpm — partial tolerance', () => {
  it('keeps pages already collected when a later page fails (one slow page does not nuke everything)', async () => {
    const fetchJson = vi
      .fn()
      .mockImplementationOnce(async () => page1) // full page -> continue
      .mockRejectedValue(new Error('slow page timeout')); // page 2 dies on both attempts
    const result = await fetchNasaDpm({}, deps(fetchJson));
    expect(result.source).toBe('live'); // partial, still served live
    expect(result.collection.features).toHaveLength(3); // page1 kept
    // page1 (1) + page2 initial attempt + 2 retries (3) = 4 calls before giving up
    expect(fetchJson).toHaveBeenCalledTimes(4);
  });
});

describe('fetchNasaDpm — short-circuits (no fetch)', () => {
  it('returns empty when the current event has no NASA block, without fetching', async () => {
    const original = process.env.GR_CURRENT_EVENT;
    process.env.GR_CURRENT_EVENT = 'no-such-event';
    try {
      const fetchJson = routedFetch();
      const result = await fetchNasaDpm({}, deps(fetchJson));
      expect(result.source).toBe('empty');
      expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
      expect(result.attribution).toBe('');
      expect(result.disclaimer).toBe('');
      expect(fetchJson).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.GR_CURRENT_EVENT;
      else process.env.GR_CURRENT_EVENT = original;
    }
  });
});

describe('fetchNasaDpm — graceful degradation', () => {
  it('degrades to stale cache when upstream fails after a prior success', async () => {
    const fetchJson = vi
      .fn()
      .mockImplementationOnce(async () => page1)
      .mockImplementationOnce(async () => page2)
      .mockRejectedValue(new Error('ArcGIS down'));
    // ttlMs -1 forces the second call to be a fresh miss that re-fetches and fails.
    const shared = deps(fetchJson, new DamageCache({ ttlMs: -1 }));
    const first = await fetchNasaDpm({}, shared);
    const second = await fetchNasaDpm({}, shared);
    expect(first.source).toBe('live');
    expect(second.source).toBe('cache'); // stale served
    expect(second.collection).toEqual(first.collection);
  });

  it('returns empty (source empty) when upstream fails with no cache', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('ArcGIS down'));
    const result = await fetchNasaDpm({}, deps(fetchJson));
    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(fetchNasaDpm({}, deps(fetchJson))).resolves.toBeDefined();
  });
});
