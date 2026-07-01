import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';

/**
 * Shape of a single record returned by the Encuéntralos `/api/personas`
 * endpoint. Only the fields we consume are typed; the API may return more.
 */
export interface EncuentralosItem {
  id: string;
  nombre: string;
  edad?: number | null;
  sexo?: string | null;
  descripcion?: string | null;
  foto?: string | null;
  ultima_ubicacion?: string | null;
  ultima_lat?: number | null;
  ultima_lng?: number | null;
  ultima_vez?: string | null;
  estado?: string | null;
  creado?: string | null;
  cedula?: string | null;
}

/**
 * Shape of the `/api/personas` response envelope.
 */
export interface EncuentralosResponse {
  items?: EncuentralosItem[];
  total?: number;
}

/**
 * Normalizes a single Encuéntralos record into the standard search result.
 */
const toStatus = makeStatusMapper({ desaparecido: 'missing', encontrado: 'found' });

export function normalizeRecord(record: EncuentralosItem): NormalizedSearchResult {
  const subtitle = [record.ultima_ubicacion, record.descripcion]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const hasLocation =
    record.ultima_lat !== null &&
    record.ultima_lat !== undefined &&
    record.ultima_lng !== null &&
    record.ultima_lng !== undefined;

  return {
    provider: 'Encuéntralos',
    provider_id: record.id,
    type: 'person',
    title: record.nombre,
    subtitle: subtitle || undefined,
    status: record.estado ?? undefined,
    location: hasLocation
      ? [record.ultima_lng as number, record.ultima_lat as number]
      : undefined,
    last_update: record.ultima_vez ?? record.creado ?? undefined,
    thumbnail: record.foto ?? undefined,
    // The site exposes a real per-person detail route (/persona/:id); link
    // straight to it instead of a search query that the SPA never seeds.
    url: `https://encuentralos.tecnosoft.dev/persona/${record.id}`,
    person: {
      fullName: record.nombre || undefined,
      cedula: record.cedula || undefined,
      age: typeof record.edad === 'number' ? record.edad : undefined,
      gender: normalizeGender(record.sexo),
      status: toStatus(record.estado),
      rawStatus: record.estado ?? undefined,
      lastSeenLocation: record.ultima_ubicacion || undefined,
      lastSeenAt: record.ultima_vez || undefined,
      photoUrl: record.foto || undefined,
    },
    metadata: {
      edad: record.edad,
      sexo: record.sexo,
      cedula: record.cedula,
    },
  };
}

/**
 * Pure parser: maps the Encuéntralos response envelope into normalized search
 * results. Returns an empty array when `items` is missing or not an array.
 */
export function parseEncuentralosResponse(
  response: EncuentralosResponse | undefined | null,
): NormalizedSearchResult[] {
  if (!response || !Array.isArray(response.items)) {
    return [];
  }

  return response.items.map(normalizeRecord);
}
