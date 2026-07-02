import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseNexoSignalResponse, NexoSignalItem } from './parser.js';

const API_BASE = 'https://gqnvienuqsrzdhpjeiyl.supabase.co/rest/v1/ninos_encontrados';

/**
 * Supabase publishable key. This is a public, embeddable anon-style key that the
 * site itself ships to the browser; it grants read-only access to the exposed
 * `ninos_encontrados` table. Safe to keep in source.
 */
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Wpao1fOWuLUgarryL7KNDA_YVxfjzA-';

export class NexoSignalAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[NexoSignalAdapter] Fetching data for query: "${query}"`);

      // Read-only PostgREST GET: case-insensitive substring match on `nombre`,
      // newest first, capped at 20 rows.
      const filter = `ilike.*${encodeURIComponent(query)}*`;
      const url =
        `${API_BASE}?select=*&nombre=${filter}&order=created_at.desc&limit=20`;

      const response = await fetchJson<NexoSignalItem[]>(url, {
        timeoutMs: 10000,
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      const normalizedResults = parseNexoSignalResponse(response);

      console.log(
        `[NexoSignalAdapter] Extracted ${normalizedResults.length} normalized results for query: "${query}"`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[NexoSignalAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
