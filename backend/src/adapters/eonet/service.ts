import type { SituationFeatureCollection } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import {
  toSortedFeatureCollection,
  EARTHQUAKES_CATEGORY,
  type EonetEventsResponse,
} from './parser.js';
import { EonetCache } from './cache.js';

const EONET_EVENTS_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';

const VALID_STATUS = new Set(['open', 'closed', 'all']);

/**
 * Known EONET category ids (live `/categories`). Used as an allowlist so
 * arbitrary/injected category strings are never forwarded upstream, and the
 * dead `earthquakes` id is filtered out even if a client asks for it.
 */
const KNOWN_CATEGORIES = new Set([
  'drought',
  'dustHaze',
  'floods',
  'landslides',
  'manmade',
  'seaLakeIce',
  'severeStorms',
  'snow',
  'tempExtremes',
  'volcanoes',
  'waterColor',
  'wildfires',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface EonetQueryParams {
  status?: string;
  category?: string;
  bbox?: string;
  start?: string;
  end?: string;
}

export type EonetSource = 'live' | 'cache' | 'empty';

export interface EonetResult {
  collection: SituationFeatureCollection;
  source: EonetSource;
}

export interface EonetDeps {
  cache: EonetCache;
  fetchJson: typeof fetchJson;
}

/** Module-level singleton cache — one shared upstream budget across clients. */
const defaultCache = new EonetCache();

function emptyCollection(): SituationFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/** bbox is valid only as exactly 4 comma-separated finite numbers. */
function validBbox(bbox: string): boolean {
  const parts = bbox.split(',');
  if (parts.length !== 4) return false;
  return parts.every((p) => p.trim() !== '' && Number.isFinite(Number(p)));
}

/**
 * Filter a comma-separated category list down to known ids, dropping unknowns
 * and the dead `earthquakes` category. Returns undefined when nothing survives.
 */
function sanitizeCategory(category: string): string | undefined {
  const kept = category
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c !== '' && c !== EARTHQUAKES_CATEGORY && KNOWN_CATEGORIES.has(c));
  return kept.length > 0 ? kept.join(',') : undefined;
}

/**
 * Build a validated EONET `/events` URL. Every param is whitelisted, validated,
 * and set via URLSearchParams (encoded) so untrusted client input cannot smuggle
 * extra params or inject into the upstream URL (threat T-12-01). Defaults
 * `status=all` so closed/historical events are included.
 */
export function buildEonetUrl(params: EonetQueryParams = {}): string {
  const search = new URLSearchParams();

  const status = params.status && VALID_STATUS.has(params.status) ? params.status : 'all';
  search.set('status', status);

  if (params.category) {
    const category = sanitizeCategory(params.category);
    if (category) search.set('category', category);
  }

  if (params.bbox && validBbox(params.bbox)) {
    search.set('bbox', params.bbox);
  }

  if (params.start && DATE_RE.test(params.start)) {
    search.set('start', params.start);
  }

  if (params.end && DATE_RE.test(params.end)) {
    search.set('end', params.end);
  }

  return `${EONET_EVENTS_URL}?${search.toString()}`;
}

/**
 * Stable cache key = the canonical (sorted) query string of the built URL, so
 * two logically-identical requests share a cache entry regardless of param order.
 */
function cacheKey(url: string): string {
  const query = url.slice(url.indexOf('?') + 1);
  return query.split('&').sort().join('&');
}

/**
 * Fetch EONET events through the cache, normalizing to a pre-sorted GeoJSON
 * FeatureCollection. Behavior:
 *  - fresh cache hit within TTL -> `source: 'cache'`, no upstream fetch;
 *  - miss -> fetch, normalize, cache, `source: 'live'`;
 *  - fetch failure (down/timeout/429) -> stale cache (`'cache'`) if present,
 *    else an empty collection (`'empty'`). NEVER throws (threat T-12-05).
 */
export async function fetchEonetEvents(
  params: EonetQueryParams = {},
  deps: EonetDeps = { cache: defaultCache, fetchJson },
): Promise<EonetResult> {
  const url = buildEonetUrl(params);
  const key = cacheKey(url);

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, source: 'cache' };

  try {
    const raw = await deps.fetchJson<EonetEventsResponse>(url);
    const collection = toSortedFeatureCollection(raw);
    deps.cache.set(key, collection);
    return { collection, source: 'live' };
  } catch (err) {
    // Graceful degradation: serve stale cache if we have any, else empty.
    console.error(
      `[eonet] upstream fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, source: 'cache' };
    return { collection: emptyCollection(), source: 'empty' };
  }
}
