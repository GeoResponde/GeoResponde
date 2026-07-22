import type { EarthquakeFeatureCollection } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { toEarthquakeCollection, type UsgsResponse } from './parser.js';
import { UsgsCache } from './cache.js';

const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface UsgsQueryParams {
  /**
   * Bounding box in the shared country-registry order [W, N, E, S] =
   * [minLon, maxLat, maxLon, minLat] (same string EONET consumes). Mapped here
   * to USGS's minlatitude/maxlatitude/minlongitude/maxlongitude params.
   */
  bbox?: string;
  /** Earliest event date as YYYY-MM-DD (the timeline preset window). */
  start?: string;
}

export type UsgsSource = 'live' | 'cache' | 'empty';

export interface UsgsResult {
  collection: EarthquakeFeatureCollection;
  source: UsgsSource;
}

export interface UsgsDeps {
  cache: UsgsCache;
  fetchJson: typeof fetchJson;
}

/** Module-level singleton cache — one shared upstream budget across clients. */
const defaultCache = new UsgsCache();

function emptyCollection(): EarthquakeFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/** Parse a [W, N, E, S] bbox string into 4 finite numbers, or undefined. */
function parseBbox(
  bbox: string,
): { w: number; n: number; e: number; s: number } | undefined {
  const parts = bbox.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [w, n, e, s] = parts;
  return { w, n, e, s };
}

/**
 * Build a validated USGS fdsnws `/query` URL. Every param is whitelisted,
 * validated, and set via URLSearchParams (encoded) so untrusted client input
 * cannot smuggle extra params or inject into the upstream URL. Always requests
 * `format=geojson`. The registry bbox ([W, N, E, S]) is transposed to USGS's
 * min/max lat/lon params.
 */
export function buildUsgsUrl(params: UsgsQueryParams = {}): string {
  const search = new URLSearchParams();
  search.set('format', 'geojson');

  if (params.bbox) {
    const box = parseBbox(params.bbox);
    if (box) {
      search.set('minlongitude', String(box.w));
      search.set('maxlatitude', String(box.n));
      search.set('maxlongitude', String(box.e));
      search.set('minlatitude', String(box.s));
    }
  }

  if (params.start && DATE_RE.test(params.start)) {
    search.set('starttime', params.start);
  }

  return `${USGS_QUERY_URL}?${search.toString()}`;
}

/** Stable cache key = the canonical (sorted) query string of the built URL. */
function cacheKey(url: string): string {
  const query = url.slice(url.indexOf('?') + 1);
  return query.split('&').sort().join('&');
}

/**
 * Fetch USGS earthquakes through the cache, normalizing to a GeoJSON
 * FeatureCollection. Behavior mirrors the EONET service:
 *  - fresh cache hit within TTL -> `source: 'cache'`, no upstream fetch;
 *  - miss -> fetch, normalize, cache, `source: 'live'`;
 *  - fetch failure (down/timeout/429) -> stale cache (`'cache'`) if present,
 *    else an empty collection (`'empty'`). NEVER throws.
 */
export async function fetchUsgsEarthquakes(
  params: UsgsQueryParams = {},
  deps: UsgsDeps = { cache: defaultCache, fetchJson },
): Promise<UsgsResult> {
  const url = buildUsgsUrl(params);
  const key = cacheKey(url);

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, source: 'cache' };

  try {
    const raw = await deps.fetchJson<UsgsResponse>(url, { timeoutMs: 10000 });
    const collection = toEarthquakeCollection(raw);
    deps.cache.set(key, collection);
    return { collection, source: 'live' };
  } catch (err) {
    console.error(
      `[usgs] upstream fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, source: 'cache' };
    return { collection: emptyCollection(), source: 'empty' };
  }
}

export async function fetchUsgsShakeMap(
  params: UsgsQueryParams = {},
  deps: UsgsDeps = { cache: defaultCache, fetchJson },
): Promise<{ collection: any; source: UsgsSource }> {
  const url = buildUsgsUrl(params) + '&producttype=shakemap&limit=3&minmagnitude=4.5';
  const key = 'shakemap_' + cacheKey(url);

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, source: 'cache' };

  try {
    const raw = await deps.fetchJson<UsgsResponse>(url, { timeoutMs: 10000 });
    
    const featureCollections = await Promise.all(
      (raw.features || []).map(async (feat) => {
        if (!feat.properties?.detail) return null;
        try {
          const detail = await deps.fetchJson<any>(feat.properties?.detail, { timeoutMs: 10000 });
          const shakemap = detail?.properties?.products?.shakemap?.[0];
          if (!shakemap) return null;
          const contUrl = shakemap.contents?.['download/cont_mmi.json']?.url;
          if (!contUrl) return null;
          
          const contourGeoJson = await deps.fetchJson<any>(contUrl, { timeoutMs: 10000 });
          
          // Inject the earthquake's timestamp into each contour feature so the frontend can filter by time
          if (contourGeoJson && Array.isArray(contourGeoJson.features) && feat.properties?.time) {
            contourGeoJson.features.forEach((f: any) => {
              if (f.properties) {
                f.properties.time = feat.properties?.time;
              }
            });
          }
          
          return contourGeoJson;
        } catch (e) {
          console.warn('[usgs] Failed to fetch shakemap for event', feat.id, e);
          return null;
        }
      })
    );

    const allFeatures = featureCollections
      .filter((fc) => fc && fc.type === 'FeatureCollection' && Array.isArray(fc.features))
      .flatMap((fc) => fc.features);

    const merged = { type: 'FeatureCollection', features: allFeatures };
    deps.cache.set(key, merged as any);
    return { collection: merged, source: 'live' };
  } catch (err) {
    console.error(`[usgs] upstream shakemap fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, source: 'cache' };
    return { collection: { type: 'FeatureCollection', features: [] }, source: 'empty' };
  }
}
