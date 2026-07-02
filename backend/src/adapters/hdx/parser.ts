import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Subset of a CKAN dataset ("package") returned by the HDX API
 * (https://data.humdata.org/api/3/action/package_search). Only the fields we
 * consume are typed.
 */
export interface HdxDataset {
  name: string;
  title?: string;
  notes?: string;
  metadata_modified?: string;
  num_resources?: number;
  organization?: { name?: string; title?: string };
  groups?: Array<{ name?: string; title?: string }>;
}

export interface HdxResponse {
  success?: boolean;
  result?: {
    count?: number;
    results?: HdxDataset[];
  };
}

const DATASET_BASE_URL = 'https://data.humdata.org/dataset/';

/**
 * Normalize a single HDX dataset into the gateway's standard result shape.
 */
export function normalizeDataset(dataset: HdxDataset): NormalizedSearchResult {
  const org = dataset.organization?.title || dataset.organization?.name;
  const locations = (dataset.groups ?? [])
    .map((g) => g.title || g.name)
    .filter(Boolean) as string[];

  const subtitleParts: string[] = [];
  if (locations.length > 0) subtitleParts.push(locations.join(', '));
  if (org) subtitleParts.push(`Source: ${org}`);

  return {
    provider: 'Humanitarian Data Exchange',
    provider_id: dataset.name,
    type: 'dataset',
    title: dataset.title?.trim() || dataset.name,
    subtitle: subtitleParts.join(' · ') || undefined,
    status: 'published',
    last_update: dataset.metadata_modified,
    url: `${DATASET_BASE_URL}${dataset.name}`,
    metadata: {
      organization: org,
      locations,
      resources: dataset.num_resources,
    },
  };
}

/**
 * Parse a full HDX package_search response into normalized results.
 */
export function parseHdxResponse(response: HdxResponse): NormalizedSearchResult[] {
  const results = response?.result?.results;
  if (!Array.isArray(results)) return [];
  return results.map(normalizeDataset);
}
