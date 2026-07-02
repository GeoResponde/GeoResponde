import type {
  EarthquakeFeature,
  EarthquakeFeatureCollection,
} from '@georesponde/shared';

/**
 * Raw USGS fdsnws `/query?format=geojson` shapes — only the fields we consume
 * are typed, and everything is optional/defensive because USGS is an untrusted
 * third-party source: a malformed response must never crash the gateway.
 */
export interface UsgsRawFeature {
  id?: string;
  properties?: {
    mag?: number | null;
    place?: string | null;
    time?: number | null;
    url?: string | null;
  } | null;
  geometry?: {
    type?: string;
    /** USGS Point coordinates: [lon, lat, depthKm]. */
    coordinates?: unknown;
  } | null;
}

export interface UsgsResponse {
  type?: string;
  features?: UsgsRawFeature[];
}

/** Attribution label for the USGS earthquake feed. */
export const USGS_ATTRIBUTION = 'USGS';

/** True when a value is a finite number within valid lat/lng bounds. */
function inRange(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/** Non-empty trimmed string, or undefined. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Normalize one raw USGS feature into a GeoJSON Point Feature, or undefined when
 * it is unusable (missing/out-of-range coordinates). Pure and defensive — never
 * throws. Only `http(s)` event URLs survive (blocks `javascript:` and friends).
 */
function toFeature(raw: UsgsRawFeature): EarthquakeFeature | undefined {
  const coords = raw.geometry?.coordinates;
  if (!Array.isArray(coords)) return undefined;

  const lng = typeof coords[0] === 'number' ? coords[0] : NaN;
  const lat = typeof coords[1] === 'number' ? coords[1] : NaN;
  if (!inRange(lng, lat)) return undefined;

  const depth = typeof coords[2] === 'number' ? coords[2] : undefined;
  const p = raw.properties ?? {};

  const url = str(p.url);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : undefined;

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: str(raw.id) ?? '',
      mag: typeof p.mag === 'number' ? p.mag : null,
      place: str(p.place) ?? '',
      time: typeof p.time === 'number' && Number.isFinite(p.time) ? p.time : null,
      ...(depth !== undefined ? { depth } : {}),
      ...(safeUrl ? { url: safeUrl } : {}),
      source: USGS_ATTRIBUTION,
    },
  };
}

/**
 * Transform a raw USGS `/query` response into a normalized GeoJSON
 * FeatureCollection: one Point Feature per usable event, dropping any event
 * without readable coordinates. Never throws on bad input.
 */
export function toEarthquakeCollection(
  raw: UsgsResponse | unknown,
): EarthquakeFeatureCollection {
  const features =
    raw && typeof raw === 'object' && Array.isArray((raw as UsgsResponse).features)
      ? ((raw as UsgsResponse).features as UsgsRawFeature[])
      : [];

  const out = features
    .map(toFeature)
    .filter((f): f is EarthquakeFeature => f !== undefined);

  return { type: 'FeatureCollection', features: out };
}
