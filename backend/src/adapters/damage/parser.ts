/**
 * Pure, network-free core of the Copernicus EMS damage adapter (Phase 14, COP-02).
 *
 * Copernicus activation JSON and the S3 layer urls it names are UNTRUSTED
 * third-party data (D-08). Every access here is guarded and optional; nothing
 * throws on malformed input (threat T-14-03). The only URLs ever returned for
 * fetching are https on the two allowlisted Copernicus hosts (SSRF guard,
 * threat T-14-02).
 *
 * Products are already CRS84 (== EPSG:4326) GeoJSON on public S3, so there is NO
 * projection/shapefile conversion and NO new dependency (D-01). Feature objects
 * pass through untouched so the existing MapLibre paint (`damage_gra`,
 * `simplified`, `value`, `obj_desc`) keeps working with zero restyle (D-09).
 */

/**
 * A merged damage FeatureCollection. Deliberately LOOSE — grading carries
 * Polygon/Line/Point geometry, so this is NOT the Point-only
 * SituationFeatureCollection (D-10). Features are opaque pass-through objects.
 */
export interface DamageFeatureCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

/** Public product slug -> Copernicus product `type` code (D-03). */
export const PRODUCT_TYPE_MAP = {
  grading: 'GRA',
  'ground-movement': 'GRM',
} as const;

/** The two — and only two — hosts the gateway will fetch layer geometry from. */
const ALLOWED_LAYER_HOSTS = new Set([
  'rapidmapping-viewer.s3.eu-west-1.amazonaws.com',
  'rapidmapping.emergency.copernicus.eu',
]);

/** Hard cap on merged features, a DoS backstop against a hostile upstream body. */
const MAX_MERGED_FEATURES = 200_000;

/**
 * True only for an https URL whose host is one of the two allowlisted Copernicus
 * hosts (D-08). Anything else — http, other hosts, non-strings, garbage — is
 * false and must never be fetched.
 */
export function isAllowedLayerUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_LAYER_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

interface RawVersion {
  number?: unknown;
  statusCode?: unknown;
}

interface RawProduct {
  type?: unknown;
  version?: RawVersion;
  layers?: unknown;
}

interface RawAoi {
  products?: unknown;
}

/** Numeric version number, or -Infinity when unreadable (sorts last). */
function versionNumber(product: RawProduct): number {
  const n = product?.version?.number;
  return typeof n === 'number' && Number.isFinite(n) ? n : -Infinity;
}

/** A product is "final" when its version.statusCode is exactly 'F'. */
function isFinal(product: RawProduct): boolean {
  return product?.version?.statusCode === 'F';
}

/**
 * Pick the representative product of a given `type` within one AOI (D-04):
 * prefer the highest-numbered FINAL version; if the AOI has that type but no
 * final version yet (open activation), fall back to the highest available
 * version so the map is not empty. Returns undefined when the AOI lacks the type.
 */
function selectProduct(
  products: RawProduct[],
  productType: 'GRA' | 'GRM',
): RawProduct | undefined {
  const matching = products.filter((p) => p?.type === productType);
  if (matching.length === 0) return undefined;

  const finals = matching.filter(isFinal);
  const pool = finals.length > 0 ? finals : matching;

  return pool.reduce((best, p) =>
    versionNumber(p) > versionNumber(best) ? p : best,
  );
}

/**
 * Walk an activation JSON to the servable layer `json` S3 urls for a product
 * type. Per AOI, selects the highest final version (D-04), collects each `vt`
 * layer's `json` url, and keeps ONLY allowlisted https Copernicus hosts (D-08) —
 * a decoy url on any other host is dropped before it is ever fetched. Merges the
 * selected products' layers across all AOIs. Pure and fully defensive: any
 * malformed shape yields `[]`, never a throw (T-14-03).
 */
export function resolveLayerUrls(raw: unknown, productType: 'GRA' | 'GRM'): string[] {
  const results =
    raw && typeof raw === 'object' ? (raw as { results?: unknown }).results : undefined;
  const firstResult = Array.isArray(results) ? results[0] : undefined;
  const aois =
    firstResult && typeof firstResult === 'object'
      ? (firstResult as { aois?: unknown }).aois
      : undefined;
  if (!Array.isArray(aois)) return [];

  const urls: string[] = [];

  for (const aoi of aois as RawAoi[]) {
    const products = aoi?.products;
    if (!Array.isArray(products)) continue;

    const product = selectProduct(products as RawProduct[], productType);
    if (!product) continue;

    const layers = product.layers;
    if (!Array.isArray(layers)) continue;

    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue;
      const jsonUrl = (layer as { json?: unknown }).json;
      if (isAllowedLayerUrl(jsonUrl)) urls.push(jsonUrl as string);
    }
  }

  return urls;
}

/** True for a plausible `{ type:'FeatureCollection', features:[] }` object. */
function isFeatureCollection(
  value: unknown,
): value is { type: string; features: unknown[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'FeatureCollection' &&
    Array.isArray((value as { features?: unknown }).features)
  );
}

/**
 * Merge fetched layer FeatureCollections into ONE DamageFeatureCollection,
 * passing feature objects through untouched (D-09). Non-object / non-collection
 * inputs and non-object features are dropped; a hard feature cap
 * ({@link MAX_MERGED_FEATURES}) bounds memory against a hostile body (T-14-03).
 * Never throws.
 */
export function mergeCollections(collections: unknown[]): DamageFeatureCollection {
  const features: unknown[] = [];
  if (!Array.isArray(collections)) return { type: 'FeatureCollection', features };

  for (const collection of collections) {
    if (!isFeatureCollection(collection)) continue;
    for (const feature of collection.features) {
      if (!feature || typeof feature !== 'object') continue;
      if (features.length >= MAX_MERGED_FEATURES) break;
      features.push(feature);
    }
    if (features.length >= MAX_MERGED_FEATURES) break;
  }

  return { type: 'FeatureCollection', features };
}
