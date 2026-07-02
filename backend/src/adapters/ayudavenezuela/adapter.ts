import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseAyudaVenezuelaResponse, AyudaVenezuelaItem } from './parser.js';

const API_BASE =
  'https://tthturshkovywsluoqtv.supabase.co/rest/v1/person_reports_public';

const ANON_KEY = process.env.AYUDA_VENEZUELA_ANON_KEY;
if (!ANON_KEY) throw new Error('Missing AYUDA_VENEZUELA_ANON_KEY env var');

/**
 * Adapter for ayudavenezuela.app missing-persons directory, served through a
 * public Supabase PostgREST view (`person_reports_public`). Auth uses the
 * publishable anon key via `apikey` + `Authorization: Bearer` headers.
 */
export class AyudaVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[AyudaVenezuelaAdapter] Fetching data for query: "${query}"`);

      const q = encodeURIComponent(`*${query}*`);
      const url =
        `${API_BASE}?or=(search_name.ilike.${q},first_name.ilike.${q},last_name.ilike.${q})` +
        `&order=created_at.desc&limit=20`;

      const response = await fetchJson<AyudaVenezuelaItem[]>(url, {
        timeoutMs: 10000,
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });

      const normalizedResults = parseAyudaVenezuelaResponse(response);

      console.log(
        `[AyudaVenezuelaAdapter] Extracted ${normalizedResults.length} normalized results for query: "${query}"`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[AyudaVenezuelaAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
