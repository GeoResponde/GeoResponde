import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';
import type { HospitalizedItem, MissingItem } from './types.js';

const toStatus = makeStatusMapper({
  desaparecido: 'missing',
  encontrado: 'found',
  localizado: 'found'
});

function setMissingSubtitle(lastLocation: string | null): string {
  if (lastLocation !== null) {
    return `Última Ubicación: ${lastLocation}`
  }
  return "Unknown"
}


export function parseMissing(record: MissingItem): NormalizedSearchResult {
  return {
    provider: 'Venezuela Rescate',
    provider_id: String(record.id),
    type: 'person',
    title: record.nombres_apellidos || 'Desconocido',
    subtitle: setMissingSubtitle(record.ultima_ubicacion) ?? undefined,
    status: toStatus(record.estado) ?? undefined,
    thumbnail: record.foto_url ?? undefined,
    url: `https://venezuelarescate.com/buscar`, //Provider does not change url when selecting a person
    person: {
      fullName: record.nombres_apellidos ?? undefined,
      status: toStatus(record.estado),
      rawStatus: record.estado ?? undefined,
      lastSeenLocation: record.ultima_ubicacion ?? undefined,
      photoUrl: record.foto_url ?? undefined,
    },
    metadata: {
      createdAt: record.created_at
    },
  };
}

function changeAgeType(age: string | null): number | null {
  if(age !== null && !isNaN(Number(age))){
    return Number(age)
  }
  return null
}

export function parseHospitalized(record: HospitalizedItem): NormalizedSearchResult {
  return {
    provider: 'Venezuela Rescate',
    provider_id: String(record.id),
    type: 'person',
    title: record.nombres_apellidos || 'Desconocido',
    subtitle: record.observaciones || '',
    status: record.estado_paciente ?? undefined,
    thumbnail: record.foto_captura_url ?? undefined,
    url: `https://venezuelarescate.com/pacientes-en-hospitales`, //Provider does not change url when selecting a person
    person: {
      fullName: record.nombres_apellidos ?? undefined,
      rawStatus: record.estado_paciente ?? undefined,
      photoUrl: record.foto_captura_url ?? undefined,
      isMinor: record.es_menor ?? undefined,
      gender: normalizeGender(record.sexo) ?? undefined,
      hospital: record.nombre_hospital ?? undefined,
      cedula: record.cedula ?? undefined,
      age: changeAgeType(record.edad) ?? undefined
    },
    metadata: {
     source: record.fuente,
     nicknames: record.nombre_variantes,
     batch_date: record.batch_date,
     created_at: record.created_at
    },
  };
}


export function parseVenezuelaRescateResponse(
  missing: MissingItem[] | undefined | null,
  hospitalized: HospitalizedItem[] | undefined | null,
): NormalizedSearchResult[] {
  let results: NormalizedSearchResult[] = []
  if (Array.isArray(missing)) {
    results.push(...missing.map(parseMissing));
  }

  if (Array.isArray(hospitalized)){
    results.push(...hospitalized.map(parseHospitalized))
  }

  return results;
}
