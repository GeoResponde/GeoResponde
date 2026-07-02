import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseApoyoSaluResponse, ApoyoSaluResponse } from './parser.js';

const APOYO_SALU_API = 'https://apoyo.salu.pro/api/missing-persons';

/**
 * Adapter for apoyo.salu.pro, a public registry of missing persons. Uses the
 * official keyless JSON API (no scraping) to federate missing-person records
 * into the Find module.
 */
export class ApoyoSaluAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  private buildUrl(query: string): string {
    const url = new URL(APOYO_SALU_API);
    url.searchParams.set('search', query);
    url.searchParams.set('limit', '10');
    return url.toString();
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[ApoyoSaluAdapter] Fetching missing persons for query: "${query}"`);
      const data = await fetchJson<ApoyoSaluResponse>(this.buildUrl(query), { timeoutMs: 10000 });
      const results = parseApoyoSaluResponse(data);
      console.log(`[ApoyoSaluAdapter] Extracted ${results.length} results for query: "${query}"`);
      return results;
    } catch (error) {
      console.error('[ApoyoSaluAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
