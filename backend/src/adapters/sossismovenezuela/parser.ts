import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';
import type { SossismoVenezuelaPerson, SossismoVenezuelaCenter } from './types.js';

const SITE_URL = 'https://sossismovenezuela.com/';

const toPersonStatus = makeStatusMapper({
  buscada: 'missing',
  localizada: 'found',
});

function sanitizeLocation(
  lng: unknown,
  lat: unknown,
): [number, number] | undefined {
  if (typeof lng !== 'number' || typeof lat !== 'number') return undefined;
  return [lng, lat];
}


/**
 * Build a subtitle from location information for centers.
 */
function buildCenterSubtitle(center: SossismoVenezuelaCenter): string | undefined {
  const parts = [center.direccion, center.address_reference, center.ciudad]
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Normalize a single missing person record into the gateway's standard shape.
 */
export function normalizePerson(record: SossismoVenezuelaPerson): NormalizedSearchResult {
  const fullName = [record.nombre, record.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Desconocido';

  return {
    provider: 'SOS Sismo Venezuela',
    provider_id: record.id,
    type: 'person',
    title: fullName,
    subtitle: record.descripcion ?? undefined,
    status: toPersonStatus(record.estado) ?? undefined,
    location: sanitizeLocation(record.longitude, record.latitude),
    last_update: record.updated_at ?? record.created_at ?? undefined,
    thumbnail: record.foto_url ?? undefined,
    url: `${SITE_URL}personas/${record.id}`,
    person: {
      fullName,
      firstName: record.nombre ?? undefined,
      lastName: record.apellido ?? undefined,
      cedula: record.venezuelan_id ?? undefined,
      age: typeof record.edad === 'number' ? record.edad : undefined,
      gender: normalizeGender(record.genero) ?? undefined,
      status: toPersonStatus(record.estado) ?? undefined,
      rawStatus: record.estado ?? undefined,
      lastSeenLocation: record.ultima_ubicacion ?? undefined,
      description: record.descripcion ?? undefined,
      photoUrl: record.foto_url ?? undefined,
      sourceName: record.source_name ?? undefined,
      contact: {
        name: record.contacto_nombre ?? undefined,
        phone: record.contacto_telefono ?? undefined,
        email: record.reporter_email ?? undefined,
      }
    },
    metadata: {
      city: record.ciudad ?? undefined,
      zone: record.zona ?? undefined,
      last_time_contacted: record.ultima_vez_contactado ?? undefined,
    },
  };
}

/**
 * Normalize a single collection center record into the gateway's standard shape.
 */
export function normalizeCenter(record: SossismoVenezuelaCenter): NormalizedSearchResult {
  return {
    provider: 'SOS Sismo Venezuela',
    provider_id: record.id,
    type: 'report',
    title: record.nombre ?? 'Centro Desconocido',
    subtitle: buildCenterSubtitle(record),
    status: record.estado ?? undefined,
    location: sanitizeLocation(record.longitude, record.latitude),
    last_update: record.updated_at ?? record.created_at ?? undefined,
    url: `${SITE_URL}centros_acopio_public`,
    metadata: {
      source: record.source ?? undefined,
      city: record.ciudad ?? undefined,
      state: record.state ?? undefined,
      municipality: record.municipality ?? undefined,
      zone: record.zone ?? undefined,
      phone: record.telefono ?? undefined,
      accepted_items: record.items_aceptados ?? undefined,
    },
  };
}

/**
 * Pure parser: maps the Sismo Venezuela Supabase responses into
 * normalized search results. Returns an empty array when inputs are invalid.
 */
export function parseSossismoVenezuelaResponse(
  persons: SossismoVenezuelaPerson[] | undefined | null,
  centers: SossismoVenezuelaCenter[] | undefined | null,
): NormalizedSearchResult[] {
  const results: NormalizedSearchResult[] = [];

  if (Array.isArray(persons)) {
    results.push(...persons.map(normalizePerson));
  }

  if (Array.isArray(centers)) {
    results.push(...centers.map(normalizeCenter));
  }

  return results;
}
