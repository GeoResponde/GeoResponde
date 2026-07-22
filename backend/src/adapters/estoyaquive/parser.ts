import { NormalizedSearchResult } from '@georesponde/shared';
import type { MissingPerson, FoundPerson, BuscarResponse } from './types.js';

function buildPhotoUrl(photoFilename: string | null): string | undefined {
  if (photoFilename) {
    return `https://estoyaquive.up.railway.app/uploads/${photoFilename}`;
  }
  return undefined;
}

export function parseMissingPerson(record: MissingPerson): NormalizedSearchResult {
  return {
    provider: 'Estoy Aquí VE',
    provider_id: String(record.id),
    type: 'person',
    title: record.nombre_completo || 'Desconocido',
    subtitle: record.descripcion || '',
    status: 'missing',
    thumbnail: buildPhotoUrl(record.foto_filename),
    url: `https://estoyaquive.up.railway.app/`,
    person: {
      fullName: record.nombre_completo ?? undefined,
      cedula: record.cedula ?? undefined,
      age: record.edad ?? undefined,
      status: 'missing',
      rawStatus: record.descripcion ?? undefined,
      lastSeenLocation: record.ultima_ubicacion ?? undefined,
      description: record.descripcion ?? undefined,
      photoUrl: buildPhotoUrl(record.foto_filename),
      contact: {
        name: record.reportado_por ?? undefined,
        phone: record.contacto_reportante ?? undefined,
      },
    },
    metadata: {
      reportedBy: record.reportado_por ?? undefined,
      reportDate: record.fecha_reporte ?? undefined,
    },
  };
}

export function parseFoundPerson(record: FoundPerson): NormalizedSearchResult {
  return {
    provider: 'Estoy Aquí VE',
    provider_id: String(record.id),
    type: 'person',
    title: record.nombre_completo || 'Desconocido',
    subtitle: record.descripcion_fisica || '',
    status: 'found',
    thumbnail: buildPhotoUrl(record.foto_filename),
    url: `https://estoyaquive.up.railway.app/`,
    person: {
      fullName: record.nombre_completo ?? undefined,
      cedula: record.cedula ?? undefined,
      age: record.edad_aproximada ?? undefined,
      status: 'found',
      rawStatus: record.estado_salud ?? undefined,
      lastSeenLocation: record.ubicacion_actual ?? undefined,
      description: record.descripcion_fisica ?? undefined,
      photoUrl: buildPhotoUrl(record.foto_filename),
      contact: {
        name: record.reportado_por ?? undefined,
        phone: record.contacto_reportante ?? undefined,
      },
    },
    metadata: {
      reportedBy: record.reportado_por ?? undefined,
      reportDate: record.fecha_reporte ?? undefined,
      healthStatus: record.estado_salud ?? undefined,
    },
  };
}

export function parseEstoyAquiVeResponse(
  buscarResponse: BuscarResponse | null | undefined,
): NormalizedSearchResult[] {
  const results: NormalizedSearchResult[] = [];
  let missing: MissingPerson[] | null | undefined = buscarResponse?.buscadas;
  let found: FoundPerson[] | null | undefined = buscarResponse?.encontradas;

  const OUTPUT_LENGTH = 20

  // Parse missing persons from /buscar (buscadas)
  if (Array.isArray(missing)) {
    missing = missing.slice(0, OUTPUT_LENGTH)
    results.push(...missing.map(parseMissingPerson));
  }

  // Parse found persons from /encontradas (encontradas)
  if (Array.isArray(found)) {
    found = found.slice(0, OUTPUT_LENGTH)
    results.push(...found.map(parseFoundPerson));
  }

  return results;
}
