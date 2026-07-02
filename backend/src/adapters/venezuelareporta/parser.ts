import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';

const toStatus = makeStatusMapper({
  buscando: 'missing',
  a_salvo: 'safe',
  encontrado: 'found',
  fallecido: 'deceased',
});

/**
 * Shape of the envelope returned by the Venezuela Reporta open API
 * (`GET /api/v1/personas`). Only the fields we consume are typed; the API may
 * include additional keys which are ignored.
 */
export interface VenezuelaReportaPersona {
  id: string;
  status: string;
  nombre: string;
  cedula: string | null;
  genero: string | null;
  edad: number | null;
  ciudad: string | null;
  zona: string | null;
  ultima_vez: string | null;
  descripcion: string | null;
  foto_url: string | null;
  menor: boolean;
  origen: string | null;
  verificado: boolean;
  created_at: string;
  ficha_url: string;
}

export interface VenezuelaReportaResponse {
  ok?: boolean;
  atribucion?: string;
  generado_at?: string;
  total?: number;
  limit?: number;
  offset?: number;
  personas?: VenezuelaReportaPersona[];
}

/**
 * Pure mapper: turns a Venezuela Reporta API envelope into the normalized
 * search result shape. Returns `[]` when `personas` is not an array.
 */
export function parseVenezuelaReportaResponse(
  response: VenezuelaReportaResponse | null | undefined,
): NormalizedSearchResult[] {
  const personas = response?.personas;
  if (!Array.isArray(personas)) {
    return [];
  }

  return personas.map((persona) => {
    const subtitle = [persona.ciudad, persona.zona, persona.descripcion]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' · ');

    const result: NormalizedSearchResult = {
      provider: 'Venezuela Reporta',
      provider_id: persona.id,
      type: 'person',
      title: persona.nombre,
      status: persona.status,
      last_update: persona.created_at,
      thumbnail: persona.foto_url || undefined,
      url: persona.ficha_url || 'https://venezuelareporta.org/',
      person: {
        fullName: persona.nombre || undefined,
        cedula: persona.cedula || undefined,
        age: typeof persona.edad === 'number' ? persona.edad : undefined,
        gender: normalizeGender(persona.genero),
        status: toStatus(persona.status),
        rawStatus: persona.status || undefined,
        lastSeenLocation: [persona.ciudad, persona.zona].filter(Boolean).join(', ') || undefined,
        lastSeenAt: persona.ultima_vez || undefined,
        description: persona.descripcion || undefined,
        photoUrl: persona.foto_url || undefined,
        isMinor: persona.menor,
        verified: persona.verificado,
        sourceName: persona.origen || undefined,
      },
      metadata: {
        cedula: persona.cedula,
        genero: persona.genero,
        edad: persona.edad,
        verificado: persona.verificado,
        menor: persona.menor,
        origen: persona.origen,
      },
    };

    if (subtitle) {
      result.subtitle = subtitle;
    }

    return result;
  });
}
