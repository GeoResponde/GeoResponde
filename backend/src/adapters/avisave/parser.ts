import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Shape of a single record returned by Avisave's public API. Only the
 * fields we consume are typed; the API may return more columns.
 */

export interface Evidence {
  kind?: string | null;
  label?: string | null;
  summary?: string | null;
  count?: number | null;
  confidence?: string | null;
  createdAt?: string | null;
}

export interface AvisaveItem {
  id: string;
  title?: string | null;
  summary?: string | null;
  severity?: string | null;
  updatedAt?: string | null;
  photo_url?: string | null;
  verification?: string | null;
  confidence?: string | null;
  catagory?: string | null;
  observedAt?: string | null;
  createdAt?: string | null;
  location?: {
    label: string,
    locality?: string,
    region?: string,
    countryCode?: string,
    latitude?: number,
    longitude?: number,
    precisionMeters?: number
  } | null;
  evidence?: Evidence[];
}

export interface AvisaveResponse {
  data: AvisaveItem[];
}

export function normalizeRecord(record: AvisaveItem): NormalizedSearchResult {
  return {
    provider: 'Avisave',
    provider_id: record.id,
    type: 'Incident',
    title: record.title || 'No título',
    subtitle: record.summary || "",
    status: record.severity ?? undefined,
    last_update: record.updatedAt ?? undefined,
    url: `https://avisave.com/incidents/${record.id}`,
    metadata: {
      verification: record.verification,
      confidence: record.confidence,
      location: record.location,
      observedAt: record.observedAt,
      createdAt: record.createdAt,
      evidence: record.evidence
    },
  };
}

/**
 * Pure parser: maps AvisaveResponse into normalized search
 * results. Returns an empty array when the `data` is not an array.
 */
export function parseAvisaveResponse(
  response: AvisaveResponse | null | undefined,
): NormalizedSearchResult[] {
  const data = response?.data
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeRecord);
}
