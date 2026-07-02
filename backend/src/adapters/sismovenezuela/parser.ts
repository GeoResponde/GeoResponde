import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * A single crowdsourced damage report from sismovenezuela.com. These are scraped
 * social-media posts (YouTube / X / Instagram) about earthquake damage, NOT
 * records about people, so they never map onto a PersonRecord. Only the fields
 * we consume are typed; every one is optional because the upstream feed is a
 * best-effort scrape and frequently leaves fields null/empty.
 */
export interface SismoVenezuelaReport {
  id?: string;
  source?: string; // 'youtube' | 'twitter' | 'instagram'
  source_url?: string;
  author?: string;
  text_content?: string;
  media_urls?: string[];
  lat?: number | null;
  lng?: number | null;
  location_name?: string | null;
  damage_level?: number; // 1-5
  scraped_at?: string; // ISO
  verified?: boolean;
  credibility?: string; // 'low' | 'medium' | 'high'
  is_comment?: boolean;
  parent_url?: string | null;
}

const SITE_URL = 'https://sismovenezuela.com/';

/**
 * Extract the report array from whatever the feed endpoint returns. The endpoint
 * has been observed to return a bare array, but may also wrap it in
 * `{ reports: [...] }` or `{ data: [...] }`, so we probe defensively and fall
 * back to an empty array for any other shape.
 */
function extractReports(response: unknown): SismoVenezuelaReport[] {
  if (Array.isArray(response)) return response as SismoVenezuelaReport[];
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.reports)) return obj.reports as SismoVenezuelaReport[];
    if (Array.isArray(obj.data)) return obj.data as SismoVenezuelaReport[];
  }
  return [];
}

/**
 * Return [lng, lat] only when both are finite numbers within valid geographic
 * ranges; otherwise undefined so the UI does not plot a bogus point at (0,0).
 */
function sanitizeLocation(
  lng: unknown,
  lat: unknown,
): [number, number] | undefined {
  if (typeof lng !== 'number' || typeof lat !== 'number') return undefined;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return undefined;
  return [lng, lat];
}

/**
 * Normalize a single crowdsourced report into the gateway's standard shape.
 */
export function normalizeReport(
  report: SismoVenezuelaReport,
): NormalizedSearchResult {
  const text = report.text_content?.trim();
  const location =
    report.location_name && report.location_name.trim()
      ? report.location_name.trim()
      : undefined;

  return {
    provider: 'Sismo Venezuela',
    provider_id: report.id ?? '',
    type: 'report',
    title: location || (text ? text.slice(0, 60) : 'Reporte'),
    subtitle: text ? text.slice(0, 140) : undefined,
    status: report.verified ? 'verified' : 'unverified',
    location: sanitizeLocation(report.lng, report.lat),
    last_update: report.scraped_at,
    thumbnail: report.media_urls?.[0] || undefined,
    url: report.source_url || SITE_URL,
    metadata: {
      source: report.source,
      damage_level: report.damage_level,
      credibility: report.credibility,
      author: report.author,
    },
  };
}

/**
 * Parse a full feed response into normalized results. Because the endpoint has
 * no `q` parameter, filtering is done client-side here: when a query is given,
 * only reports whose text, location or author contain it (case-insensitive) are
 * kept. Results are capped at 25.
 */
export function parseSismoVenezuelaFeed(
  response: unknown,
  query?: string,
): NormalizedSearchResult[] {
  const reports = extractReports(response);
  const term = query?.trim().toLowerCase();

  const filtered = term
    ? reports.filter((r) => {
        const haystack = [r.text_content, r.location_name, r.author]
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
    : reports;

  return filtered.slice(0, 25).map(normalizeReport);
}
