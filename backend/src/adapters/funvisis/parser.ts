import type {
  EarthquakeFeature,
  EarthquakeFeatureCollection,
} from '@georesponde/shared';

/**
 * Raw SismosVE `/api/sismos` shapes — only the fields we consume are typed, and
 * everything is optional/defensive because SismosVE is an untrusted third-party
 * source: a malformed response must never crash the gateway. SismosVE federates
 * official FUNVISIS data as a GeoJSON-style feed.
 */
export interface SismosVeRawFeature {
  id?: string | number;
  geometry?: {
    type?: string;
    /** Point coordinates: [lng, lat]. */
    coordinates?: unknown;
  } | null;
  properties?: {
    /** Magnitude — SismosVE sends it as a numeric string, e.g. "2.0". */
    value?: number | string | null;
    /** Depth — SismosVE sends it as a string with unit, e.g. "4.0 km". */
    depth?: number | string | null;
    /** Human place description. */
    addressFormatted?: string | null;
    /** Local date — SismosVE uses DD-MM-YYYY, e.g. "01-07-2026". */
    date?: string | null;
    /** Local time, e.g. "13:39" or "14:32:10". */
    time?: string | null;
    country?: string | null;
    url?: string | null;
  } | null;
}

export interface SismosVeResponse {
  type?: string;
  /** GeoJSON-style feed. */
  features?: SismosVeRawFeature[];
  /** Some SismosVE shapes nest under `sismos` instead of `features`. */
  sismos?: SismosVeRawFeature[];
}

/** Attribution label REQUIRED on FUNVISIS data federated through SismosVE. */
export const FUNVISIS_ATTRIBUTION = 'FUNVISIS (vía SismosVE)';

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
 * Coerce a numeric field that may arrive as a number or a string (optionally
 * with a unit, e.g. "4.0 km" or "2.0"), returning the leading finite number or
 * null. Defensive against garbage.
 */
function toNum(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = parseFloat(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Normalize a SismosVE date to `YYYY-MM-DD`. SismosVE uses `DD-MM-YYYY`
 * (e.g. "01-07-2026"); an already-ISO `YYYY-MM-DD` is passed through. Returns
 * undefined when the shape is unrecognized.
 */
function normalizeDate(date: string): string | undefined {
  const parts = date.split('-');
  if (parts.length !== 3) return undefined;
  const [a, b, c] = parts;
  if (a.length === 4) return `${a}-${b}-${c}`; // already YYYY-MM-DD
  if (c.length === 4) return `${c}-${b}-${a}`; // DD-MM-YYYY -> YYYY-MM-DD
  return undefined;
}

/** Venezuela local time is UTC-4 year-round (no DST). */
const VE_UTC_OFFSET = '-04:00';

/** Pad a "HH:MM" time to "HH:MM:SS"; pass through "HH:MM:SS" and anything else. */
function normalizeTime(t: string): string {
  return /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t;
}

/**
 * Combine SismosVE `date` + `time` into an epoch (ms), or null when unparseable.
 * Handles SismosVE's DD-MM-YYYY date and HH:MM(:SS) time. SismosVE reports
 * Venezuela LOCAL time, so the zone is pinned explicitly to UTC-4 — the result
 * is independent of the host `TZ` (a server in UTC and one in America/Caracas
 * now agree on the same instant).
 */
function toEpoch(date?: string | null, time?: string | null): number | null {
  const raw = str(date);
  if (!raw) return null;
  const iso = normalizeDate(raw);
  if (!iso) return null;
  const t = str(time);
  const candidates = t
    ? [
        `${iso}T${normalizeTime(t)}${VE_UTC_OFFSET}`,
        `${iso}T${t}${VE_UTC_OFFSET}`,
        `${iso}T00:00:00${VE_UTC_OFFSET}`,
      ]
    : [`${iso}T00:00:00${VE_UTC_OFFSET}`];
  for (const candidate of candidates) {
    const epoch = Date.parse(candidate);
    if (Number.isFinite(epoch)) return epoch;
  }
  return null;
}

/**
 * Normalize one raw SismosVE feature into a GeoJSON Point Feature, or undefined
 * when it is unusable (missing/out-of-range coordinates). Pure and defensive —
 * never throws. Only `http(s)` urls survive (blocks `javascript:` and friends).
 */
function toFeature(raw: SismosVeRawFeature): EarthquakeFeature | undefined {
  const coords = raw.geometry?.coordinates;
  if (!Array.isArray(coords)) return undefined;

  const lng = typeof coords[0] === 'number' ? coords[0] : NaN;
  const lat = typeof coords[1] === 'number' ? coords[1] : NaN;
  if (!inRange(lng, lat)) return undefined;

  const p = raw.properties ?? {};
  const depth = toNum(p.depth);
  const url = str(p.url);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : undefined;

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: raw.id != null ? String(raw.id) : '',
      mag: toNum(p.value),
      place: str(p.addressFormatted) ?? '',
      time: toEpoch(p.date, p.time),
      ...(depth !== null ? { depth } : {}),
      ...(safeUrl ? { url: safeUrl } : {}),
      source: FUNVISIS_ATTRIBUTION,
    },
  };
}

/**
 * Transform a raw SismosVE response into a normalized GeoJSON FeatureCollection:
 * one Point Feature per usable event, dropping any event without readable
 * coordinates. Accepts either `features` or `sismos` arrays. Never throws.
 */
export function toEarthquakeCollection(
  raw: SismosVeResponse | unknown,
): EarthquakeFeatureCollection {
  const obj = raw && typeof raw === 'object' ? (raw as SismosVeResponse) : undefined;
  const list = Array.isArray(obj?.features)
    ? obj!.features
    : Array.isArray(obj?.sismos)
      ? obj!.sismos
      : [];

  const features = list
    .map(toFeature)
    .filter((f): f is EarthquakeFeature => f !== undefined);

  return { type: 'FeatureCollection', features };
}
