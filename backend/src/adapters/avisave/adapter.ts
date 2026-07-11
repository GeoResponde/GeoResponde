import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseAvisaveResponse, AvisaveResponse } from './parser.js';

const API_BASE = 'https://api.avisave.com/api/public/incidents';

/**
 * Adapter for Your Provider (https://api.avisave/public/incidents), a
 * incident registry exposing a public JSON endpoint.
 */
export class AvisaveAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {

      const url = `${API_BASE}?search=${encodeURIComponent(query)}&limit=20`;
      const response = await fetchJson<AvisaveResponse>(url, { timeoutMs: 10000 });

      const normalizedResults = parseAvisaveResponse(response);

      console.log(
        `[Avisave] Extracted ${normalizedResults.length} normalized results`
      );

      return normalizedResults;
    } catch (error) {
      console.error('[Avisave] Search failed: (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
