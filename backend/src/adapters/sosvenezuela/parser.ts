import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper } from '../person.js';

/**
 * Shape of a single person record returned by the SOS Venezuela 2026
 * `/api/persons/list` endpoint. Only the fields we consume are typed; the API
 * may return more.
 */
export interface SosVenezuelaItem {
  id: string;
  status?: string | null;
  display_name?: string | null;
  cedula_masked?: string | null;
  municipio?: string | null;
  parroquia?: string | null;
  hospital_name?: string | null;
  photo_path?: string | null;
  source_date?: string | null;
}

/**
 * The endpoint may return a bare array of records, or wrap them in an envelope
 * under `persons` or `items`. Both shapes are accepted.
 */
export interface SosVenezuelaResponse {
  persons?: SosVenezuelaItem[];
  items?: SosVenezuelaItem[];
}

/**
 * SOS Venezuela 2026 has no per-person detail page; every result links to the
 * public search page.
 */
const SEARCH_URL = 'https://sosvenezuela2026.com/buscar';

const toStatus = makeStatusMapper({
  seeking_info: 'missing',
  found_alive: 'safe',
  found_dead: 'deceased',
});

/**
 * Normalizes a single SOS Venezuela 2026 record into the standard search result.
 */
export function normalizeRecord(record: SosVenezuelaItem): NormalizedSearchResult {
  const parts = [record.parroquia, record.municipio].filter(
    (part): part is string => Boolean(part),
  );
  const subtitle = parts.join(' · ');
  const location = parts.join(', ');

  return {
    provider: 'SOS Venezuela 2026',
    provider_id: record.id,
    type: 'person',
    title: record.display_name ?? '',
    subtitle: subtitle || undefined,
    status: record.status ?? undefined,
    last_update: record.source_date ?? undefined,
    thumbnail: record.photo_path || undefined,
    url: SEARCH_URL,
    person: {
      fullName: record.display_name || undefined,
      cedula: record.cedula_masked || undefined,
      status: toStatus(record.status),
      rawStatus: record.status ?? undefined,
      lastSeenLocation: location || undefined,
      hospital: record.hospital_name || undefined,
      lastSeenAt: record.source_date || undefined,
      photoUrl: record.photo_path || undefined,
    },
    metadata: {
      municipio: record.municipio,
      parroquia: record.parroquia,
    },
  };
}

/**
 * Pure parser: maps the SOS Venezuela 2026 response into normalized search
 * results. Defensive about the envelope shape: accepts a bare array, or an
 * object exposing `persons` or `items`. Returns `[]` for anything else.
 */
export function parseSosVenezuelaResponse(
  response: SosVenezuelaResponse | SosVenezuelaItem[] | undefined | null,
): NormalizedSearchResult[] {
  let items: SosVenezuelaItem[] | undefined;

  if (Array.isArray(response)) {
    items = response;
  } else if (response && Array.isArray(response.persons)) {
    items = response.persons;
  } else if (response && Array.isArray(response.items)) {
    items = response.items;
  }

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeRecord);
}
