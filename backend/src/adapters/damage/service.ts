import { getEvent, currentEventId } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import {
  PRODUCT_TYPE_MAP,
  resolveLayerUrls,
  mergeCollections,
  isAllowedLayerUrl,
  type DamageFeatureCollection,
} from './parser.js';
import { DamageCache } from './cache.js';

/**
 * Public Copernicus EMS Rapid Mapping activation-detail base (D-02). The EMSR
 * code is appended as a validated `code=` query param via URLSearchParams —
 * never interpolated raw — so an untrusted activationId cannot alter the url.
 */
const ACTIVATION_BASE =
  'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/';

/** EMSR activation codes look like `EMSR884`; anything else is rejected (D-08). */
const EMSR_RE = /^EMSR\d+$/;

export type DamageSource = 'live' | 'cache' | 'empty';

export interface DamageResult {
  collection: DamageFeatureCollection;
  attribution: string;
  source: DamageSource;
}

export interface DamageDeps {
  cache: DamageCache;
  fetchJson: typeof fetchJson;
}

/** Module-level singleton cache — one shared 6h budget across clients. */
const defaultDeps: DamageDeps = { cache: new DamageCache(), fetchJson };

function emptyCollection(): DamageFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * Build the validated public-activations `?code=<EMSR>` url. Returns undefined
 * when `activationId` does not match `/^EMSR\d+$/`, so a malformed/injected id
 * never reaches the network (D-08). The code is set via URLSearchParams.
 */
export function buildActivationUrl(activationId: string): string | undefined {
  if (!EMSR_RE.test(activationId)) return undefined;
  const url = new URL(ACTIVATION_BASE);
  url.searchParams.set('code', activationId);
  return url.toString();
}

/**
 * Fetch + merge a Copernicus damage product ('grading' -> GRA, 'ground-movement'
 * -> GRM) as cached GeoJSON. Two-stage, degrade-safe (D-06):
 *   - unknown product / no active event / no Copernicus activation
 *       -> empty collection, source 'empty', NO upstream fetch;
 *   - fresh in-TTL cache hit -> source 'cache', NO re-fetch;
 *   - miss -> fetch activation JSON, resolve SSRF-guarded layer urls, fetch +
 *       merge each, cache -> source 'live';
 *   - any upstream failure -> stale cache ('cache') if present, else empty
 *       ('empty'). NEVER throws, NEVER returns 5xx (threat T-14-04).
 *
 * Attribution is the active event's `copernicus.attribution` when the event
 * exists, else the empty string (D-07).
 */
export async function fetchCopernicusProduct(
  product: string,
  deps: DamageDeps = defaultDeps,
): Promise<DamageResult> {
  const productType = (PRODUCT_TYPE_MAP as Record<string, 'GRA' | 'GRM'>)[product];

  const eventId = currentEventId();
  const event = getEvent(eventId);
  const activation = event?.copernicus;
  const attribution = activation?.attribution ?? '';

  // Fail-closed short-circuits — no upstream fetch.
  if (!productType || !activation) {
    return { collection: emptyCollection(), attribution, source: 'empty' };
  }

  const key = `${eventId}:${product}`;

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, attribution, source: 'cache' };

  const activationUrl = buildActivationUrl(activation.activationId);
  if (!activationUrl) {
    return { collection: emptyCollection(), attribution, source: 'empty' };
  }

  try {
    const raw = await deps.fetchJson<unknown>(activationUrl, { timeoutMs: 10000 });
    const layerUrls = resolveLayerUrls(raw, productType).filter(isAllowedLayerUrl);
    const collections = await Promise.all(
      layerUrls.map((u) => deps.fetchJson<unknown>(u, { timeoutMs: 10000 })),
    );
    const collection = mergeCollections(collections);
    deps.cache.set(key, collection);
    return { collection, attribution, source: 'live' };
  } catch (err) {
    console.error(
      `[damage] upstream fetch failed, degrading gracefully: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    const stale = deps.cache.getStale(key);
    if (stale) return { collection: stale, attribution, source: 'cache' };
    return { collection: emptyCollection(), attribution, source: 'empty' };
  }
}
