import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseAvisave, Avisave } from './parser.js';

const API_BASE = 'https://api.avisave.com/api/public/incidents';

/**
 * Adapter for Your Provider (https://your-provider.example/), a missing
 * persons registry exposing a public JSON endpoint.
 */
export class AvisaveAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[Avisave] Fetching data for query: "${query}"`);

      const url = `${API_BASE}?search=${encodeURIComponent(query)}&limit=20`;
      const response = await fetchJson<Avisave[]>(url, { timeoutMs: 10000 });

      const normalizedResults = parseAvisave(response);
      const [first] = parseAvisave(response);
      console.log(first)

      console.log(
        `[Avisave] Extracted ${normalizedResults.length} normalized results for query: "${query}"`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[Avisave] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
