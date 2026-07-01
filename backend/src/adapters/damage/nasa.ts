/**
 * NASA ARIA "Likelihood of Damaged Structures" (DPM) adapter (Phase 15, NASA-01).
 *
 * The DPM is a public, anonymous ArcGIS FeatureServer in EPSG:4326 holding
 * ~2.7M polygons, of which only ~58,870 carry `damage=1`. This adapter NEVER
 * fetches the whole layer: every query is MANDATORY-filtered to `where=damage=1`,
 * paginated `resultRecordCount=2000` / `resultOffset` ordered by `fid`, with a
 * hard page cap as a DoS backstop (ND-03, T-15-03). It reuses Phase 14's
 * `DamageCache` (1h TTL) + `mergeCollections`, mirrors the Copernicus service's
 * degrade-safe shape (fresh -> stale -> empty, never throws, never 5xx, T-15-04),
 * and reshapes nothing — `damage_probability` / `label` pass through so the
 * existing MapLibre paint keeps working (ND-08).
 *
 * LIVE-PATH NOTE (verified against the FeatureServer on 2026-07-01): the
 * `where=damage=1` attribute filter alone already bounds the query to the ~58,870
 * damaged polygons (a count-only probe returns 58,870 in <1s) — it is the
 * always-on server-side guard ND-03 mandates. The country-bbox *envelope*, by
 * contrast, is NOT sent on the default path: this hosted layer's spatial query
 * combined with `resultRecordCount>=1000` reproducibly times out server-side and
 * returns an empty body (HTTP 200, 0 features, ~56s) — sending it would return
 * NOTHING. Since the whole DPM product is already geographically scoped to the
 * event (its extent is the Caracas region, wholly inside VE), the envelope adds
 * no narrowing anyway. The envelope plumbing is retained as a validated, opt-in
 * `?bbox` capability (ND-05) but stays dormant; per-page partial tolerance keeps
 * one slow page from nuking the whole result.
 */
import { getEvent, currentEventId } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { mergeCollections, type DamageFeatureCollection } from './parser.js';
import { DamageCache } from './cache.js';
import type { DamageSource } from './service.js';

/** The one — and only — host the gateway will fetch DPM geometry from (ND-07). */
const ALLOWED_ARCGIS_HOSTS = new Set(['services7.arcgis.com']);

/** ArcGIS `maxRecordCount` for this layer; also the page size we request. */
const DEFAULT_PAGE_SIZE = 2000;

/**
 * Hard cap on pages fetched — a DoS backstop so a hostile/broken upstream that
 * always returns a full page cannot loop forever (T-15-03). 40 * 2000 = 80,000,
 * comfortably above the ~58,870 damaged polygons for the seeded event.
 */
const MAX_PAGES = 40;

/**
 * Per-page fetch budget. Cursor pages return in ~0.6-10s; a broken/very slow page
 * is cut off here so it cannot stall the whole request — the loop keeps the pages
 * already collected (partial tolerance) instead of throwing them all away.
 */
const PAGE_TIMEOUT_MS = 30000;

/**
 * Extra attempts per page before giving up. This hosted layer's per-page latency
 * is variable (a sparse-region page that usually returns in ~6s occasionally
 * spikes past the timeout); a single retry recovers those transient spikes so the
 * full ~58,870-polygon set is retrieved reliably instead of truncating early.
 */
const PAGE_RETRIES = 2;

/**
 * The layer's OID field. We paginate by an ascending `fid` cursor
 * (`fid>lastSeen`) rather than `resultOffset`, because deep `resultOffset` on
 * this 2.7M-feature hosted layer scans from the start every page and slows
 * linearly (~2s per 1,000 offset), timing out well before the full ~58,870
 * damaged set is retrieved. An OID cursor uses the index and stays fast at any
 * depth — a full live extraction of all 58,870 damaged polygons completes in
 * ~30 pages (verified 2026-07-01).
 */
const OID_FIELD = 'fid';

/**
 * True only for an https URL whose host is the allowlisted ArcGIS host (ND-07).
 * Anything else — http, other hosts, non-strings, garbage — is false and must
 * never be fetched. The NASA sibling of Phase 14's `isAllowedLayerUrl`.
 */
export function isAllowedArcgisUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_ARCGIS_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Parse an untrusted `?bbox` override into a `[minLng,minLat,maxLng,maxLat]`
 * tuple, ONLY when `raw` is exactly four comma-separated FINITE numbers (ND-07).
 * Returns undefined for the wrong count, non-numeric, NaN/Infinity, or a
 * non-string. Never throws — the caller falls back to the country bbox.
 */
export function parseBboxParam(raw: unknown): [number, number, number, number] | undefined {
  if (typeof raw !== 'string') return undefined;
  const parts = raw.split(',');
  if (parts.length !== 4) return undefined;
  const nums = parts.map((p) => Number(p.trim()));
  if (!nums.every((n) => Number.isFinite(n))) return undefined;
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Reorder a COUNTRY_BBOX tuple (stored W,N,E,S for EONET) into the ArcGIS
 * envelope string `xmin,ymin,xmax,ymax` = `W,S,E,N` (ND-03). Example:
 * `[-73.4,12.2,-59.8,0.6]` -> `'-73.4,0.6,-59.8,12.2'`.
 */
export function bboxToEnvelope(box: [number, number, number, number]): string {
  const [w, n, e, s] = box;
  return `${w},${s},${e},${n}`;
}

/**
 * Build one filtered, cursor-paginated ArcGIS `f=geojson` query url. Appends
 * `/query` when absent, and sets every param via URLSearchParams — never
 * raw-interpolated (T-15-01). The effective where is
 * `${where} AND ${idField}>${cursor}`: the registry `damage=1` filter (ND-03)
 * PLUS an ascending OID cursor so each page uses the index instead of a deep
 * `resultOffset` scan. Always carries `outFields` (with the OID field ensured so
 * the cursor is readable), `f=geojson`, `orderByFields=<idField>` (stable
 * ascending order) and `resultRecordCount`. The spatial `geometry`/`geometryType`/
 * `inSR`/`spatialRel` params are added ONLY when an `envelope` is supplied — the
 * default path omits them because this hosted layer's spatial query combined with
 * a large page size times out server-side and returns nothing (see the module
 * header). Returns undefined when `baseUrl` fails the ArcGIS host allowlist
 * (ND-07). Start pagination with `cursor: -1` (all OIDs are > -1).
 */
export function buildDpmQueryUrl(
  baseUrl: string,
  opts: {
    where: string;
    outFields: string;
    envelope?: string;
    cursor: number;
    idField?: string;
    recordCount?: number;
  },
): string | undefined {
  if (!isAllowedArcgisUrl(baseUrl)) return undefined;
  let url: URL;
  try {
    url = new URL(baseUrl.endsWith('/query') ? baseUrl : `${baseUrl}/query`);
  } catch {
    return undefined;
  }
  const idField = opts.idField ?? OID_FIELD;
  // Guard the cursor: only a finite integer is interpolated into the where; a
  // bad value falls back to -1 (fetch from the start) rather than injecting.
  const cursor = Number.isFinite(opts.cursor) ? Math.trunc(opts.cursor) : -1;
  // Ensure the OID field is in outFields so the next cursor is always readable.
  const fields = opts.outFields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (!fields.includes(idField)) fields.push(idField);

  const params = url.searchParams;
  params.set('where', `${opts.where} AND ${idField}>${cursor}`);
  if (opts.envelope) {
    params.set('geometry', opts.envelope);
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  params.set('outFields', fields.join(','));
  params.set('f', 'geojson');
  params.set('orderByFields', idField);
  params.set('resultRecordCount', String(opts.recordCount ?? DEFAULT_PAGE_SIZE));
  return url.toString();
}

/** Read the OID cursor (last feature's id field) from an ArcGIS page body. */
function lastCursor(page: unknown, idField: string): number | undefined {
  if (
    !page ||
    typeof page !== 'object' ||
    !Array.isArray((page as { features?: unknown }).features)
  ) {
    return undefined;
  }
  const features = (page as { features: unknown[] }).features;
  const last = features[features.length - 1];
  const props =
    last && typeof last === 'object'
      ? (last as { properties?: Record<string, unknown> }).properties
      : undefined;
  const id = props?.[idField];
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined;
}

/**
 * Merge fetched ArcGIS page FeatureCollections into ONE DamageFeatureCollection,
 * delegating to Phase 14's `mergeCollections` (pass-through + hard feature cap).
 * Junk pages are dropped; feature properties are untouched; never throws.
 */
export function mergeArcgisPages(pages: unknown[]): DamageFeatureCollection {
  return mergeCollections(pages);
}

export interface NasaDamageResult {
  collection: DamageFeatureCollection;
  attribution: string;
  disclaimer: string;
  source: DamageSource;
}

export interface NasaDeps {
  cache: DamageCache;
  fetchJson: typeof fetchJson;
  /** Injectable page size so tests can force pagination with small fixtures. */
  pageSize?: number;
}

/**
 * Module-level singleton — a shared 1h budget (ND-04). ARIA products are revised
 * as new Sentinel-1 passes land, so the TTL is shorter than Copernicus's 6h.
 */
const defaultDeps: NasaDeps = {
  cache: new DamageCache({ ttlMs: 60 * 60 * 1000, maxEntries: 8 }),
  fetchJson,
};

function emptyCollection(): DamageFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/** Feature count of an unknown page body, or 0 when it is not a collection. */
function pageFeatureCount(page: unknown): number {
  if (
    page &&
    typeof page === 'object' &&
    Array.isArray((page as { features?: unknown }).features)
  ) {
    return (page as { features: unknown[] }).features.length;
  }
  return 0;
}

/**
 * Fetch the current event's DPM as cached, filtered, paginated GeoJSON. Flow
 * mirrors `fetchCopernicusProduct` (ND-04):
 *   - no active event / no NASA block / no `dpm` FeatureServer
 *       -> empty collection, source 'empty', NO upstream fetch;
 *   - fresh in-TTL cache hit (keyed by event + product + envelope) -> 'cache';
 *   - miss -> loop `buildDpmQueryUrl(offset=0,2000,...)` fetching each page,
 *       stop on a short page (< pageSize) OR the hard page cap, merge, cache ->
 *       'live';
 *   - any page fetch throws/times out -> stale cache ('cache') if present, else
 *       empty ('empty').
 * The `where` sent upstream is ALWAYS the registry `damage=1` (ND-03). NEVER
 * throws, NEVER returns 5xx. Attribution + disclaimer come from `event.nasa`
 * (ND-06); on the empty/no-block path both are ''.
 */
export async function fetchNasaDpm(
  opts: { bbox?: string; eventId?: string } = {},
  deps: NasaDeps = defaultDeps,
): Promise<NasaDamageResult> {
  const eventId = opts.eventId ?? currentEventId();
  const event = getEvent(eventId);
  const nasa = event?.nasa;
  const dpm = nasa?.featureServers.find((fs) => fs.key === 'dpm');
  const attribution = nasa?.attribution ?? '';
  const disclaimer = nasa?.disclaimer ?? '';

  // Fail-closed short-circuits — no upstream fetch.
  if (!event || !nasa || !dpm) {
    return { collection: emptyCollection(), attribution, source: 'empty', disclaimer };
  }

  // An OPTIONAL client `?bbox` override is already minLng,minLat,maxLng,maxLat
  // (ArcGIS envelope order), so join as-is (ND-05). The default path sends NO
  // envelope: the country-bbox spatial query times out on this layer (see the
  // module header), and `where=damage=1` already bounds the result (ND-03).
  const clientBbox = parseBboxParam(opts.bbox);
  const envelope = clientBbox ? clientBbox.join(',') : undefined;

  // Cache key distinguishes the default (country-scoped) result from any bbox
  // override so the two never collide.
  const key = `${eventId}:dpm:${envelope ?? 'default'}`;

  const fresh = deps.cache.get(key);
  if (fresh) return { collection: fresh, attribution, source: 'cache', disclaimer };

  const pageSize = deps.pageSize ?? DEFAULT_PAGE_SIZE;
  const outFields = dpm.outFields ?? '*';

  // Partial tolerance (mirrors Phase 14's Promise.allSettled resilience): a slow
  // or failed page STOPS pagination but keeps every page collected so far — one
  // bad page never nukes the whole result. Only a total wipeout (page 0 itself
  // fails) degrades to stale/empty. Pagination is by an ascending OID cursor
  // (`fid>lastSeen`), NOT deep resultOffset, so pages stay fast at any depth.
  const pages: unknown[] = [];
  let pageError: unknown;
  let cursor = -1;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = buildDpmQueryUrl(dpm.url, {
      where: dpm.where,
      outFields,
      envelope,
      cursor,
      idField: OID_FIELD,
      recordCount: pageSize,
    });
    // Defense in depth: only allowlisted https ArcGIS urls are ever fetched.
    if (!url || !isAllowedArcgisUrl(url)) break;
    let body: unknown;
    let ok = false;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
      try {
        body = await deps.fetchJson<unknown>(url, { timeoutMs: PAGE_TIMEOUT_MS });
        ok = true;
        break;
      } catch (err) {
        lastErr = err; // retry a transient upstream latency spike once
      }
    }
    if (!ok) {
      pageError = lastErr; // only record when the page ultimately failed
      break; // keep the pages already collected; stop paginating
    }

    pages.push(body);
    // A short page (fewer than a full page) ends pagination normally.
    if (pageFeatureCount(body) < pageSize) break;
    // Advance the cursor to the last OID; if unreadable, stop (cannot page on).
    const next = lastCursor(body, OID_FIELD);
    if (next === undefined || next <= cursor) break;
    cursor = next;
  }

  if (pages.length > 0) {
    if (pageError) {
      console.error(
        `[damage:nasa] pagination stopped early after a page failure, serving partial result: ${
          pageError instanceof Error ? pageError.message : String(pageError)
        }`,
      );
    }
    const collection = mergeArcgisPages(pages);
    deps.cache.set(key, collection);
    return { collection, attribution, source: 'live', disclaimer };
  }

  // Page 0 itself failed — degrade gracefully (never throw, never 5xx, T-15-04).
  console.error(
    `[damage:nasa] upstream query failed, degrading gracefully: ${
      pageError instanceof Error ? pageError.message : String(pageError)
    }`,
  );
  const stale = deps.cache.getStale(key);
  if (stale) return { collection: stale, attribution, source: 'cache', disclaimer };
  return { collection: emptyCollection(), attribution, source: 'empty', disclaimer };
}
