import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * A single lost/found pet report returned by the MiGenteVE REST API
 * (https://migenteve.com/api/reports). Only the fields we consume are typed.
 * This is a PET registry, not a person registry, so results carry no `person`
 * block and never expose phone/email data.
 */
export interface MiGenteVeReport {
  id: string;
  status?: string; // 'perdido' | 'encontrado' | 'reunido' | 'medico'
  pet_name?: string;
  species?: string; // 'Perro' | 'Gato' | ...
  sex?: string;
  size?: string;
  breed?: string;
  color?: string;
  city?: string;
  zone?: string;
  lat?: number | null;
  lng?: number | null;
  details?: string;
  photo_url?: string; // relative '/uploads/...' or absolute
  created_at?: number; // epoch ms
}

export interface MiGenteVeResponse {
  reports?: MiGenteVeReport[];
  mapPoints?: unknown[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

const SITE_BASE_URL = 'https://migenteve.com';
const DETAIL_BASE_URL = `${SITE_BASE_URL}/reporte/`;

/**
 * Return sanitized [lng, lat] only when both coordinates are finite numbers
 * within valid geographic bounds; otherwise undefined. The upstream feed
 * sometimes emits null or broken coordinates.
 */
function sanitizeLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
): [number, number] | undefined {
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    return [lng, lat];
  }
  return undefined;
}

/**
 * Resolve a report photo into an absolute URL, or undefined when unusable.
 */
function resolveThumbnail(photoUrl: string | undefined): string | undefined {
  if (typeof photoUrl !== 'string' || photoUrl.length === 0) return undefined;
  if (photoUrl.startsWith('http')) return photoUrl;
  if (photoUrl.startsWith('/')) return `${SITE_BASE_URL}${photoUrl}`;
  return undefined;
}

/**
 * Normalize a single MiGenteVE pet report into the gateway's standard shape.
 */
export function normalizeReport(report: MiGenteVeReport): NormalizedSearchResult {
  const subtitle = [report.species, report.breed, report.zone, report.city]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  return {
    provider: 'Patitas a Salvo VE',
    provider_id: report.id,
    type: 'pet',
    title: report.pet_name || 'Sin nombre',
    subtitle: subtitle || undefined,
    status: report.status,
    location: sanitizeLocation(report.lat, report.lng),
    last_update: report.created_at
      ? new Date(report.created_at).toISOString()
      : undefined,
    thumbnail: resolveThumbnail(report.photo_url),
    url: `${DETAIL_BASE_URL}${report.id}`,
    metadata: {
      species: report.species,
      breed: report.breed,
      sex: report.sex,
      size: report.size,
      city: report.city,
      zone: report.zone,
      color: report.color,
    },
  };
}

/**
 * Parse a full MiGenteVE reports response into normalized results.
 * Reads `response.reports`; returns [] when it is not an array.
 */
export function parseMiGenteVeResponse(
  response: MiGenteVeResponse,
): NormalizedSearchResult[] {
  const reports = response?.reports;
  if (!Array.isArray(reports)) return [];
  return reports.map(normalizeReport);
}
