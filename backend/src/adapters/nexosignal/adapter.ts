import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseNexoSignalResponse, NexoSignalItem } from './parser.js';

const API_BASE = 'https://gqnvienuqsrzdhpjeiyl.supabase.co/rest/v1/ninos_encontrados';

const SUPABASE_PUBLISHABLE_KEY = process.env.NEXOSIGNAL_PUBLISHABLE_KEY;
if (!SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing NEXOSIGNAL_PUBLISHABLE_KEY env var');

export class NexoSignalAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[NexoSignalAdapter] Fetching data`);

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
        `[NexoSignalAdapter] Extracted ${normalizedResults.length} normalized results`,
      );

      return normalizedResults;
    } catch {
      console.error('[NexoSignalAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
