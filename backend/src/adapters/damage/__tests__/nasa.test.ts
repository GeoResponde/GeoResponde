import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  isAllowedArcgisUrl,
  parseBboxParam,
  bboxToEnvelope,
  buildDpmQueryUrl,
  mergeArcgisPages,
  filterByBbox,
  warmNasaDpm,
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

// --- Task 2: filterByBbox (viewport AABB filter) -------------------------

describe('filterByBbox — geometry-AABB viewport filter', () => {
  const full = mergeArcgisPages([page1, page2]); // fids 1..4, disjoint polygons

  it('keeps only features whose geometry AABB intersects the viewport', () => {
    // A tight box around fid1 only ([-66.9,10.5]..[-66.8,10.6]).
    const subset = filterByBbox(full, [-66.92, 10.49, -66.79, 10.61]);
    const fids = subset.features.map((f) => (f as { properties: { fid: number } }).properties.fid);
    expect(fids).toEqual([1]);
  });

  it('returns more features as the viewport grows (count scales with size)', () => {
    const small = filterByBbox(full, [-66.92, 10.49, -66.79, 10.61]); // fid1
    const medium = filterByBbox(full, [-66.92, 10.39, -66.59, 10.61]); // fid1+2
    const large = filterByBbox(full, [-67.0, 10.0, -66.0, 11.0]); // all 4
    expect(small.features.length).toBeLessThan(medium.features.length);
    expect(medium.features.length).toBeLessThan(large.features.length);
    expect(large.features).toHaveLength(4);
  });

  it('returns an empty collection for a viewport that intersects nothing', () => {
    const none = filterByBbox(full, [10, 10, 11, 11]); // far away
    expect(none.features).toHaveLength(0);
    expect(none.type).toBe('FeatureCollection');
  });

  it('passes features through untouched (properties preserved)', () => {
    const subset = filterByBbox(full, [-67.0, 10.0, -66.0, 11.0]);
    expect(subset.features).toContainEqual(page1.features[0]);
  });
});

// --- Task 3: warmNasaDpm (full-set extraction) ---------------------------

describe('warmNasaDpm — full OID-cursor extraction into the stable cache', () => {
  it('paginates the filtered DPM query and caches the merged full set', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    const collection = await warmNasaDpm({}, shared);
    expect(collection?.features).toHaveLength(4); // 3 (page1) + 1 (page2)
    // page1 (full, 3==pageSize) then page2 (short) => exactly 2 fetches
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('always sends where=damage=1 + resultRecordCount and NO spatial envelope (ND-03)', async () => {
    const fetchJson = routedFetch();
    await warmNasaDpm({}, deps(fetchJson));
    for (const call of fetchJson.mock.calls) {
      const url = call[0] as string;
      expect(url).toContain('where=damage%3D1');
      expect(url).toContain('resultRecordCount=');
      expect(url).not.toContain('geometry=');
      expect(isAllowedArcgisUrl(url.split('?')[0])).toBe(true);
    }
  });

  it('caps pagination at the hard page cap when every page is full (DoS backstop)', async () => {
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
    await warmNasaDpm({}, deps(fetchJson));
    expect(fetchJson.mock.calls.length).toBe(40); // hard page cap
  });

  it('is idempotent — a second warm with a fresh cache does not re-query', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await warmNasaDpm({}, shared);
    await warmNasaDpm({}, shared);
    expect(fetchJson).toHaveBeenCalledTimes(2); // second warm served from cache
  });

  it('de-dupes concurrent warms into ONE upstream extraction', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    const [a, b] = await Promise.all([warmNasaDpm({}, shared), warmNasaDpm({}, shared)]);
    expect(a?.features).toHaveLength(4);
    expect(b?.features).toHaveLength(4);
    expect(fetchJson).toHaveBeenCalledTimes(2); // not 4 — the in-flight warm was joined
  });

  it('keeps pages already collected when a later page fails, but does NOT cache the partial set', async () => {
    const fetchJson = vi
      .fn()
      .mockImplementationOnce(async () => page1) // full page -> continue
      .mockRejectedValue(new Error('slow page timeout')); // page 2 dies on both attempts
    const shared = deps(fetchJson);
    const collection = await warmNasaDpm({}, shared);
    expect(collection?.features).toHaveLength(3); // page1 returned to the caller
    // page1 (1) + page2 initial attempt + 2 retries (3) = 4 calls before giving up
    expect(fetchJson).toHaveBeenCalledTimes(4);
    // A truncated set must not be pinned for 6h — the next request re-warms.
    const result = await fetchNasaDpm({}, shared);
    expect(result.source).toBe('warming');
  });

  it('returns undefined and does not cache when the whole extraction fails', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('ArcGIS down'));
    const shared = deps(fetchJson);
    const collection = await warmNasaDpm({}, shared);
    expect(collection).toBeUndefined();
    // a follow-up fetch still sees no cache => warming, and retries the warm
    const result = await fetchNasaDpm({}, shared);
    expect(result.source).toBe('warming');
  });

  it('returns undefined when the current event has no NASA block, without fetching', async () => {
    const original = process.env.GR_CURRENT_EVENT;
    process.env.GR_CURRENT_EVENT = 'no-such-event';
    try {
      const fetchJson = routedFetch();
      const collection = await warmNasaDpm({}, deps(fetchJson));
      expect(collection).toBeUndefined();
      expect(fetchJson).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.GR_CURRENT_EVENT;
      else process.env.GR_CURRENT_EVENT = original;
    }
  });
});

// --- Task 4: fetchNasaDpm (warm-cache viewport serving) ------------------

describe('fetchNasaDpm — warming state', () => {
  it('returns empty + source warming and kicks a background warm on a cold cache', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    const result = await fetchNasaDpm({}, shared);
    expect(result.source).toBe('warming');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
    // attribution + disclaimer are still surfaced while warming (ND-06)
    expect(result.attribution).toContain('NASA-JPL');
    expect(result.disclaimer).toContain('Experimental');
    // the background warm eventually fills the cache; a later request is served
    await warmNasaDpm({}, shared);
    const warmed = await fetchNasaDpm({}, shared);
    expect(warmed.source).toBe('cache');
    expect(warmed.collection.features).toHaveLength(4);
  });

  it('does not block the request for the extraction (returns before warm resolves)', async () => {
    let resolvePage: (v: unknown) => void = () => {};
    const gate = new Promise((r) => {
      resolvePage = r;
    });
    const fetchJson = vi.fn(async () => {
      await gate; // upstream hangs
      return page2;
    });
    const result = await fetchNasaDpm({}, deps(fetchJson));
    expect(result.source).toBe('warming'); // returned WITHOUT awaiting the hung fetch
    resolvePage(page2); // let the background warm settle so the test exits cleanly
  });
});

describe('fetchNasaDpm — warm-cache serving', () => {
  it('serves the full (capped) set from cache when no bbox is given', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await warmNasaDpm({}, shared); // pre-warm
    const result = await fetchNasaDpm({}, shared);
    expect(result.source).toBe('cache');
    expect(result.collection.features).toHaveLength(4);
    expect(fetchJson).toHaveBeenCalledTimes(2); // serving did not re-query
  });

  it('filters the warm set to the requested ?bbox viewport (in-memory, no fetch)', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await warmNasaDpm({}, shared);
    const callsAfterWarm = fetchJson.mock.calls.length;
    // A box around fid1 only.
    const result = await fetchNasaDpm({ bbox: '-66.92,10.49,-66.79,10.61' }, shared);
    expect(result.source).toBe('cache');
    const fids = result.collection.features.map(
      (f) => (f as { properties: { fid: number } }).properties.fid,
    );
    expect(fids).toEqual([1]);
    expect(fetchJson).toHaveBeenCalledTimes(callsAfterWarm); // NO extra fetch for the subset
  });

  it('scales the subset with the viewport size', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await warmNasaDpm({}, shared);
    const small = await fetchNasaDpm({ bbox: '-66.92,10.49,-66.79,10.61' }, shared);
    const large = await fetchNasaDpm({ bbox: '-67,10,-66,11' }, shared);
    expect(small.collection.features.length).toBeLessThan(large.collection.features.length);
    expect(large.collection.features).toHaveLength(4);
  });

  it('ignores a malformed ?bbox and returns the full set', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);
    await warmNasaDpm({}, shared);
    const result = await fetchNasaDpm({ bbox: 'garbage' }, shared);
    expect(result.collection.features).toHaveLength(4);
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

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(fetchNasaDpm({}, deps(fetchJson))).resolves.toBeDefined();
  });
});
