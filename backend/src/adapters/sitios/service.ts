import type { AidSiteFeatureCollection } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { toAidSiteCollection, type SitiosResponse } from './parser.js';
import { SitiosCache } from './cache.js';

const SITIOS_URL = 'https://venezuelareporta.org/api/v1/sitios';

export interface SitiosQueryParams {
  tipo?: string;
  municipio?: string;
}

export type SitiosSource = 'live' | 'cache' | 'empty';

export interface SitiosResult {
  collection: AidSiteFeatureCollection;
  source: SitiosSource;
}

export interface SitiosDeps {
  cache: SitiosCache;
  fetchJson: typeof fetchJson;
}

/** Module-level singleton cache — one shared upstream budget across clients. */
const defaultCache = new SitiosCache();

function emptyCollection(): AidSiteFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * Build a validated VR `/sitios` URL. Both params are optional free-text
 * filters; they are encoded via URLSearchParams so untrusted client input
 * cannot smuggle extra params or inject into the upstream URL.
 */
export function buildSitiosUrl(params: SitiosQueryParams = {}): string {
  const search = new URLSearchParams();
  if (params.tipo && params.tipo.trim()) search.set('tipo', params.tipo.trim());
  if (params.municipio && params.municipio.trim())
    search.set('municipio', params.municipio.trim());
  const qs = search.toString();
  return qs ? `${SITIOS_URL}?${qs}` : SITIOS_URL;
}

/** Stable cache key = the canonical (sorted) query string of the built URL. */
function cacheKey(url: string): string {
  const i = url.indexOf('?');
  if (i === -1) return '';
  return url.slice(i + 1).split('&').sort().join('&');
}

/**
 * Fetch VR aid sites through the cache, normalizing to a GeoJSON
 * FeatureCollection. Behavior mirrors the EONET service:
 *  - fresh cache hit within TTL -> `source: 'cache'`, no upstream fetch;
 *  - miss -> fetch, normalize, cache, `source: 'live'`;
 *  - fetch failure (down/timeout/429) -> stale cache (`'cache'`) if present,
 *    else an empty collection (`'empty'`). NEVER throws.
 */
export async function fetchAidSites(
  params: SitiosQueryParams = {},
  deps: SitiosDeps = { cache: defaultCache, fetchJson },
): Promise<SitiosResult> {
  const url = buildSitiosUrl(params);
  const key = cacheKey(url);

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, source: 'cache' };

  try {
    const raw = await deps.fetchJson<SitiosResponse>(url, { timeoutMs: 10000 });
    const collection = toAidSiteCollection(raw);
    deps.cache.set(key, collection);
    return { collection, source: 'live' };
  } catch (err) {
    console.error(
      `[sitios] upstream fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, source: 'cache' };
    return { collection: emptyCollection(), source: 'empty' };
  }
}
