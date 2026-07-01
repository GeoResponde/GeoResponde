import { NormalizedSearchResult } from '@georesponde/shared';
import { normalizeGender } from '../person.js';

/**
 * Shape of a single record returned by Venezuela Reporta's `/api/v1/ingresos`
 * endpoint (hospital-intake roster). Only the fields we consume are typed; the
 * API may return more. `cedula` arrives null or already masked from VR.
 */
export interface IngresoRaw {
  id?: string | number;
  nombre?: string | null;
  cedula?: string | null;
  edad?: number | null;
  sexo?: string | null;
  procedencia?: string | null;
  ubicacion?: string | null;
  recopilado_de?: string | null;
  fuente?: string | null;
  ficha_url?: string | null;
  created_at?: string | null;
}

/** Shape of the `/ingresos` response envelope. */
export interface IngresosResponse {
  ok?: boolean;
  atribucion?: string;
  total?: number;
  personas?: IngresoRaw[];
}

/** Non-empty trimmed string, or undefined. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Normalize one hospital-intake record into the standard search result.
 *
 * IMPORTANT: NO status is emitted. Appearing in an intake roster does NOT
 * confirm a person is safe (per the VR note), so both the top-level `status`
 * and `person.status` are intentionally left undefined.
 */
export function normalizeIngreso(record: IngresoRaw): NormalizedSearchResult {
  const nombre = str(record.nombre) ?? '';
  const ubicacion = str(record.ubicacion);
  const procedencia = str(record.procedencia);
  const fuente = str(record.fuente);
  const ficha = str(record.ficha_url);
  const url = ficha && /^https?:\/\//i.test(ficha) ? ficha : 'https://venezuelareporta.org/';

  const subtitle = [ubicacion, procedencia]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const result: NormalizedSearchResult = {
    // Attribution ("Venezuela Reporta") preserved on all VR data (API terms).
    provider: 'Venezuela Reporta',
    provider_id: record.id != null ? String(record.id) : '',
    type: 'person',
    title: nombre,
    url,
    last_update: str(record.created_at),
    person: {
      fullName: nombre || undefined,
      // cedula arrives null or already masked from VR — pass through as-is.
      cedula: str(record.cedula),
      age: typeof record.edad === 'number' ? record.edad : undefined,
      gender: normalizeGender(record.sexo),
      // NO status: a roster appearance does not confirm safety.
      hospital: ubicacion,
      lastSeenLocation: ubicacion,
      sourceName: fuente,
    },
    metadata: {
      cedula: record.cedula ?? null,
      sexo: record.sexo ?? null,
      edad: record.edad ?? null,
      procedencia: record.procedencia ?? null,
      recopilado_de: record.recopilado_de ?? null,
      fuente: record.fuente ?? null,
    },
  };

  if (subtitle) result.subtitle = subtitle;

  return result;
}

/**
 * Pure parser: maps the `/ingresos` envelope into normalized search results.
 * Returns an empty array when `personas` is missing or not an array.
 */
export function parseIngresosResponse(
  response: IngresosResponse | undefined | null,
): NormalizedSearchResult[] {
  if (!response || !Array.isArray(response.personas)) {
    return [];
  }
  return response.personas.map(normalizeIngreso);
}
