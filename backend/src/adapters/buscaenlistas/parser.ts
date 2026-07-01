import { NormalizedSearchResult } from '@georesponde/shared';

const BASE_URL = 'https://buscaenlistasvzla.info';

/**
 * Pure transform: maps the flat array returned by
 * `GET /search?q=<query>` into the normalized search result shape.
 * Returns `[]` when the input is not an array.
 */
export function parseBuscaEnListasResponse(arr: any[]): NormalizedSearchResult[] {
  if (!Array.isArray(arr)) return [];

  return arr.map((record) => normalizeRecord(record));
}

function normalizeRecord(record: any): NormalizedSearchResult {
  const name: string = record?.name ?? '';
  const found: string | undefined = record?.found || undefined;
  const img: string = record?.img || '';

  const subtitle = [record?.place, record?.note]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' · ');

  const hasLocation = Boolean(record?.lat) && Boolean(record?.lon);

  return {
    provider: 'Busca en Listas VZLA',
    provider_id: img || `${name}|${found ?? ''}`,
    type: 'person',
    title: name,
    subtitle: subtitle || undefined,
    status: record?.missing_match ? 'posible coincidencia' : 'listado',
    location: hasLocation ? [record.lon, record.lat] : undefined,
    last_update: found,
    thumbnail: img ? `${BASE_URL}/image/${img}` : undefined,
    // The site is a SPA that only searches on user input; `/?q=` does not
    // deep-link to a result and there is no per-person page. Link to the
    // source list photo when available (the actual OCR'd hospital/shelter
    // list evidence), otherwise fall back to the site home.
    url: img ? `${BASE_URL}/image/${img}` : `${BASE_URL}/`,
    metadata: {
      age: record?.age ?? null,
      sex: record?.sex ?? '',
      cedula: record?.cedula ?? '',
      place: record?.place ?? '',
      match: record?.match ?? null,
    },
  };
}
