import type { EarthquakeFeatureCollection } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { toEarthquakeCollection, type SismosVeResponse } from './parser.js';
import { FunvisisCache } from './cache.js';

const SISMOSVE_URL = 'https://sismosve.rafnixg.dev/api/sismos';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface FunvisisQueryParams {
  /** Earliest event date as YYYY-MM-DD (the timeline preset window). */
  start?: string;
}

export type FunvisisSource = 'live' | 'cache' | 'empty';

export interface FunvisisResult {
  collection: EarthquakeFeatureCollection;
  source: FunvisisSource;
}

export interface FunvisisDeps {
  cache: FunvisisCache;
  fetchJson: typeof fetchJson;
}

/** Module-level singleton cache — one shared upstream budget across clients. */
const defaultCache = new FunvisisCache();

function emptyCollection(): EarthquakeFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * Filter a normalized collection down to events at/after `start`. SismosVE has
 * no server-side date filter, so the timeline window is applied here. Features
 * with a null time are kept (we cannot prove they are outside the window).
 */
function filterByStart(
  collection: EarthquakeFeatureCollection,
  start?: string,
): EarthquakeFeatureCollection {
  if (!start || !DATE_RE.test(start)) return collection;
  const cutoff = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(cutoff)) return collection;
  return {
    type: 'FeatureCollection',
    features: collection.features.filter(
      (f) => f.properties.time === null || f.properties.time >= cutoff,
    ),
  };
}

/**
 * Fetch FUNVISIS earthquakes (via the OSS SismosVE feed) through the cache,
 * normalizing to a GeoJSON FeatureCollection. Behavior mirrors the USGS/EONET
 * services:
 *  - fresh cache hit within TTL -> `source: 'cache'`, no upstream fetch;
 *  - miss -> fetch, normalize, cache, `source: 'live'`;
 *  - fetch failure (down/timeout) -> stale cache (`'cache'`) if present, else an
 *    empty collection (`'empty'`). NEVER throws.
 * The full feed is cached; the `start` window is applied to the served result so
 * different windows share one upstream fetch. Attribution "FUNVISIS (vía
 * SismosVE)" is carried on every feature.
 */
export async function fetchFunvisisEarthquakes(
  params: FunvisisQueryParams = {},
  deps: FunvisisDeps = { cache: defaultCache, fetchJson },
): Promise<FunvisisResult> {
  const key = 'all';

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: filterByStart(fresh, params.start), source: 'cache' };

  try {
    const raw = await deps.fetchJson<SismosVeResponse>(SISMOSVE_URL, { timeoutMs: 10000 });
    const collection = toEarthquakeCollection(raw);
    deps.cache.set(key, collection);
    return { collection: filterByStart(collection, params.start), source: 'live' };
  } catch (err) {
    console.error(
      `[funvisis] SismosVE fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: filterByStart(stale, params.start), source: 'cache' };
    return { collection: emptyCollection(), source: 'empty' };
  }
}
