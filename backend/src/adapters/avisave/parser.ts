import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Shape of a single record returned by Your Provider's public API. Only the
 * fields we consume are typed; the API may return more columns.
 */

export interface Avisave {
  id: string;
  title?: string | null;
  summary?: string | null;
  severity?: string | null;
  updatedAt?: string | null;
  photo_url?: string | null;
}

export function normalizeRecord(record: Avisave): NormalizedSearchResult {
  return {
    provider: 'Avisave',
    provider_id: record.id,
    type: 'Incident',
    title: record.title || 'No título',
    subtitle: record.summary || "",
    status: record.severity ?? undefined,
    last_update: record.updatedAt ?? undefined,
    url: `https://avisave.com/incidents/${record.id}`,
    metadata: {},
  };
}

/**
 * Pure parser: maps Avisave's array response into normalized search
 * results. Returns an empty array when the `data` is not an array.
 */
export function parseAvisave(
  response: Avisave[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response?.data)) {
    return [];
  }

  return response?.data.map(normalizeRecord);
}
