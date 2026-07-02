import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';

/**
 * Shape of a single row returned by the Ayuda Venezuela Supabase PostgREST
 * `person_reports_public` view. Only the fields we consume are typed; the API
 * may return more columns.
 */
export interface AyudaVenezuelaItem {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  search_name?: string | null;
  age?: number | null;
  age_approx?: boolean | number | null;
  sex?: string | null;
  status?: string | null;
  last_seen_state?: string | null;
  last_seen_municipality?: string | null;
  last_seen_zone?: string | null;
  physical_description?: string | null;
  clothing?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  is_minor?: boolean | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const toStatus = makeStatusMapper({
  missing: 'missing',
  searching: 'missing',
  in_hospital: 'hospitalized',
  found_alive: 'safe',
  found_dead: 'deceased',
  deceased: 'deceased',
});

/**
 * Normalizes a single Ayuda Venezuela record into the standard search result.
 */
export function normalizeRecord(record: AyudaVenezuelaItem): NormalizedSearchResult {
  const title =
    [record.first_name, record.last_name].filter(Boolean).join(' ').trim() ||
    record.search_name ||
    'Desconocido';

  const subtitle =
    [record.last_seen_zone, record.last_seen_municipality, record.last_seen_state]
      .filter((part): part is string => Boolean(part))
      .join(' · ') || undefined;

  const lastSeenLocation =
    [record.last_seen_zone, record.last_seen_municipality, record.last_seen_state]
      .filter(Boolean)
      .join(', ') || undefined;

  return {
    provider: 'Ayuda Venezuela',
    provider_id: record.id,
    type: 'person',
    title,
    subtitle,
    status: record.status ?? undefined,
    last_update: record.updated_at ?? record.created_at ?? undefined,
    thumbnail: record.photo_url ?? undefined,
    // Ayuda Venezuela has no per-person detail page; link to the directory.
    url: 'https://ayudavenezuela.app/directorio',
    person: {
      fullName: title,
      firstName: record.first_name ?? undefined,
      lastName: record.last_name ?? undefined,
      age: typeof record.age === 'number' ? record.age : undefined,
      gender: normalizeGender(record.sex),
      status: toStatus(record.status),
      rawStatus: record.status ?? undefined,
      lastSeenLocation,
      description: record.physical_description ?? undefined,
      photoUrl: record.photo_url ?? undefined,
      isMinor: record.is_minor ?? undefined,
      sourceName: record.source ?? undefined,
    },
    metadata: {
      source: record.source,
      is_minor: record.is_minor,
    },
  };
}

/**
 * Pure parser: maps the Ayuda Venezuela PostgREST array response into
 * normalized search results. Returns an empty array when the input is not an
 * array.
 */
export function parseAyudaVenezuelaResponse(
  response: AyudaVenezuelaItem[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map(normalizeRecord);
}
