import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Shape of a single record returned by the Busca NexoSignal Supabase PostgREST
 * `ninos_encontrados` table. Only the fields we consume are typed; the API may
 * return more columns.
 *
 * NOTE: these are FOUND children. `cedula_reporta` is the national ID of the
 * person WHO REPORTS the sighting, never the child's — it must not land in
 * `person.cedula`.
 */
export interface NexoSignalItem {
  id: number;
  nombre: string;
  edad?: number | null;
  hospital?: string | null;
  estado_salud?: string | null;
  encontrado_en?: string | null;
  dice_de_si?: string | null;
  quien_reporta?: string | null;
  telefono_contacto?: string | null;
  foto_url?: string | null;
  created_at?: string | null;
  cedula_reporta?: string | null;
}

const PROVIDER = 'Busca NexoSignal';
const SITE_URL = 'https://busca.nexosignal.co/';

/**
 * Normalizes a single NexoSignal record into the standard search result.
 */
export function normalizeRecord(record: NexoSignalItem): NormalizedSearchResult {
  const subtitle = [record.encontrado_en, record.hospital, record.dice_de_si]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return {
    provider: PROVIDER,
    provider_id: String(record.id),
    type: 'person',
    title: record.nombre,
    subtitle: subtitle || undefined,
    status: record.estado_salud ?? undefined,
    last_update: record.created_at ?? undefined,
    thumbnail: record.foto_url || undefined,
    // There is no per-child detail page; link to the search site root.
    url: SITE_URL,
    person: {
      fullName: record.nombre,
      age: typeof record.edad === 'number' ? record.edad : undefined,
      status: 'found',
      rawStatus: record.estado_salud || undefined,
      hospital: record.hospital || undefined,
      lastSeenLocation: record.encontrado_en || undefined,
      description: record.dice_de_si || undefined,
      photoUrl: record.foto_url || undefined,
      isMinor: true,
    },
    metadata: {
      hospital: record.hospital,
      estado_salud: record.estado_salud,
      quien_reporta: record.quien_reporta,
      // Cédula of the REPORTER, not the child.
      reporter_cedula: record.cedula_reporta,
    },
  };
}

/**
 * Pure parser: maps the NexoSignal PostgREST array response into normalized
 * search results. Returns an empty array when the input is not an array.
 */
export function parseNexoSignalResponse(
  response: NexoSignalItem[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map(normalizeRecord);
}
