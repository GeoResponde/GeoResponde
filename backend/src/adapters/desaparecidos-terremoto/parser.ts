import { NormalizedSearchResult } from '@georesponde/shared';

const PROVIDER_NAME = 'Desaparecidos Terremoto VE';
const FALLBACK_URL = 'https://desaparecidosterremotovenezuela.com/';
const MAX_RESULTS = 25;

/**
 * Pure, testable core of the DesaparecidosTerremoto adapter. Given the raw
 * `/api/plataformas` array and a search query, it filters and normalizes the
 * aid-platform directory into the standard result shape.
 *
 * - When `query` is non-empty, keeps items whose `nombre`, `categoria` or
 *   `descripcion` (lowercased) include the lowercased query.
 * - When `query` is empty, returns the first 25 items.
 * - Caps the output at 25 results in every case.
 */
export function filterAndNormalizePlataformas(
  items: any[],
  query: string,
): NormalizedSearchResult[] {
  const source = Array.isArray(items) ? items : [];
  const normalizedQuery = (query ?? '').trim().toLowerCase();

  const matched = normalizedQuery
    ? source.filter((item) => {
        const haystack = [item?.nombre, item?.categoria, item?.descripcion]
          .filter((value) => typeof value === 'string')
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : source;

  return matched.slice(0, MAX_RESULTS).map(normalizePlataforma);
}

function normalizePlataforma(item: any): NormalizedSearchResult {
  const subtitle = [item?.categoria, item?.descripcion]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' · ');

  return {
    provider: PROVIDER_NAME,
    provider_id: String(item?.id),
    type: 'resource',
    title: item?.nombre,
    subtitle: subtitle || undefined,
    status: 'active',
    last_update: item?.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
    url: item?.url || FALLBACK_URL,
    metadata: { categoria: item?.categoria },
  };
}
