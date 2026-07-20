import type { EarthquakeFeatureCollection } from '@georesponde/shared';
import { fetchText } from '../../transports/rest/client.js';
import { toEarthquakeCollection } from './parser.js';
import { GeofonCache } from './cache.js';

const GEOFON_QUERY_URL = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface GeofonQueryParams {
  /**
   * Bounding box in the shared country-registry order [W, N, E, S] =
   * [minLon, maxLat, maxLon, minLat] (same string EONET consumes).
   */
  bbox?: string;
  /** Earliest event date as YYYY-MM-DD (the timeline preset window). */
  start?: string;
}

export type GeofonSource = 'live' | 'cache' | 'empty';

export interface GeofonResult {
  collection: EarthquakeFeatureCollection;
  source: GeofonSource;
}

export interface GeofonDeps {
  cache: GeofonCache;
  fetchText: typeof fetchText;
}

const defaultCache = new GeofonCache();

function emptyCollection(): EarthquakeFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function parseBbox(
  bbox: string,
): { w: number; n: number; e: number; s: number } | undefined {
  const parts = bbox.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [w, n, e, s] = parts;
  return { w, n, e, s };
}

export function buildGeofonUrl(params: GeofonQueryParams = {}): string {
  const search = new URLSearchParams();
  search.set('format', 'text');
  // Optional limit to protect memory. 1000 is generous for recent earthquakes.
  search.set('limit', '1000');

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

  return `${GEOFON_QUERY_URL}?${search.toString()}`;
}

function cacheKey(url: string): string {
  const query = url.slice(url.indexOf('?') + 1);
  return query.split('&').sort().join('&');
}

export async function fetchGeofonEarthquakes(
  params: GeofonQueryParams = {},
  deps: GeofonDeps = { cache: defaultCache, fetchText },
): Promise<GeofonResult> {
  const url = buildGeofonUrl(params);
  const key = cacheKey(url);

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, source: 'cache' };

  try {
    const raw = await deps.fetchText(url, { timeoutMs: 10000 });
    const collection = toEarthquakeCollection(raw);
    deps.cache.set(key, collection);
    return { collection, source: 'live' };
  } catch (err) {
    console.error(
      `[geofon] upstream fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, source: 'cache' };
    return { collection: emptyCollection(), source: 'empty' };
  }
}
