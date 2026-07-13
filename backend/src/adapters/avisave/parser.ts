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

export interface Location {
  label: string,
  locality?: string | undefined,
  region?: string | undefined,
  countryCode?: string | undefined,
  latitude?: number | undefined,
  longitude?: number | undefined,
  precisionMeters?: number | undefined
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
  category?: string | null;
  observedAt?: string | null;
  createdAt?: string | null;
  location?: Location | null;
  evidence?: Evidence[];
}

export interface AvisaveResponse {
  data: AvisaveItem[];
}

/*
 * Returns the longitude and latitude from the location object
 * Returns undefined if not present
*/

function resolveLocation(location: Location | null | undefined): [number, number] | undefined {
  if (location?.longitude != null && location?.latitude != null) {
    return [location.longitude, location?.latitude]
  }
  return undefined
}

export function normalizeRecord(record: AvisaveItem): NormalizedSearchResult {
  return {
    provider: 'Avisave',
    provider_id: record.id,
    type: record.category ||'No Category',
    title: record.title || 'No título',
    subtitle: record.summary || "",
    status: record.severity ?? undefined,
    location: resolveLocation(record.location) ?? undefined,
    last_update: record.updatedAt ?? undefined,
    url: `https://avisave.com/incidents/${record.id}`,
    metadata: {
      verification: record.verification,
      location: record.location,
      observedAt: record.observedAt,
      confidence: record.confidence ?? null,
      createdAt: record.createdAt,
      evidence: record.evidence,
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
