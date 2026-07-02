import type {
  AidSiteFeature,
  AidSiteFeatureCollection,
  AidSiteTipo,
} from '@georesponde/shared';

/** Attribution label REQUIRED by the VR API terms on every aid-site feature. */
const SITIOS_ATTRIBUTION = 'Venezuela Reporta';

/** Known VR site types. Anything else is bucketed into 'otro' (whitelist). */
const KNOWN_TIPOS = new Set<AidSiteTipo>(['acopio', 'clinica', 'hospital', 'refugio', 'otro']);

/** Whitelist a raw `tipo` against the known set, falling back to 'otro'. */
function normalizeTipo(value: unknown): AidSiteTipo {
  const t = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return KNOWN_TIPOS.has(t as AidSiteTipo) ? (t as AidSiteTipo) : 'otro';
}

/**
 * Raw Venezuela Reporta `/api/v1/sitios` shapes — only the fields we consume are
 * typed, and everything is optional/defensive because VR is an untrusted
 * third-party source: a malformed response must never crash the gateway.
 */
export interface SitioRaw {
  id?: string | number;
  tipo?: string;
  nombre?: string;
  lat?: number | null;
  lng?: number | null;
  municipio?: string | null;
  estado_operativo?: string | null;
  necesidades?: unknown;
  personas_estimadas?: number | null;
  nota?: string | null;
  frescura?: string | null;
  ultimo_reporte_at?: string | null;
  reportes?: number | null;
  origen?: string | null;
  ficha_url?: string | null;
}

export interface SitiosResponse {
  ok?: boolean;
  atribucion?: string;
  sitios?: SitioRaw[];
}

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

/** Coerce an unknown `necesidades` value into a clean string array. */
function toNeeds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map((n) => n.trim());
}

/** Non-empty trimmed string, or undefined. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Normalize one raw VR site into a GeoJSON Point Feature, or undefined when it
 * is unusable (missing/out-of-range coordinates). Pure and defensive — never
 * throws. Only `http(s)` ficha URLs survive (blocks `javascript:` and friends).
 */
function toFeature(site: SitioRaw): AidSiteFeature | undefined {
  const lng = typeof site.lng === 'number' ? site.lng : NaN;
  const lat = typeof site.lat === 'number' ? site.lat : NaN;
  if (!inRange(lng, lat)) return undefined;

  const ficha = str(site.ficha_url);
  const fichaUrl = ficha && /^https?:\/\//i.test(ficha) ? ficha : undefined;

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: site.id != null ? String(site.id) : '',
      tipo: normalizeTipo(site.tipo),
      source: SITIOS_ATTRIBUTION,
      nombre: str(site.nombre) ?? '',
      ...(str(site.municipio) ? { municipio: str(site.municipio) } : {}),
      ...(str(site.estado_operativo)
        ? { estado_operativo: str(site.estado_operativo) }
        : {}),
      necesidades: toNeeds(site.necesidades),
      ...(typeof site.personas_estimadas === 'number'
        ? { personas_estimadas: site.personas_estimadas }
        : {}),
      ...(str(site.nota) ? { nota: str(site.nota) } : {}),
      ...(str(site.frescura) ? { frescura: str(site.frescura) } : {}),
      ...(str(site.ultimo_reporte_at)
        ? { ultimo_reporte_at: str(site.ultimo_reporte_at) }
        : {}),
      ...(fichaUrl ? { fichaUrl } : {}),
    },
  };
}

/**
 * Transform a raw VR `/sitios` response into a GeoJSON FeatureCollection: one
 * Point Feature per mappable site, dropping any site without usable
 * coordinates. Never throws on bad input.
 */
export function toAidSiteCollection(
  raw: SitiosResponse | unknown,
): AidSiteFeatureCollection {
  const sitios =
    raw && typeof raw === 'object' && Array.isArray((raw as SitiosResponse).sitios)
      ? ((raw as SitiosResponse).sitios as SitioRaw[])
      : [];

  const features = sitios
    .map(toFeature)
    .filter((f): f is AidSiteFeature => f !== undefined);

  return { type: 'FeatureCollection', features };
}
