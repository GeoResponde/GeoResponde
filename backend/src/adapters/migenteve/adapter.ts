import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseMiGenteVeResponse, MiGenteVeResponse } from './parser.js';

const MIGENTEVE_API = 'https://migenteve.com/api/reports';

/**
 * Adapter for MiGenteVE (migenteve.com), a Venezuelan lost/found PET registry.
 * Uses the site's own open REST API (CORS-open, no auth) to federate pet
 * reports into the Find module. Results describe animals, not people, so they
 * carry no `person` block and expose no contact data.
 */
export class MiGenteVeAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  private buildUrl(query: string): string {
    const url = new URL(MIGENTEVE_API);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '20');
    return url.toString();
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[MiGenteVeAdapter] Fetching pet reports`);
      const data = await fetchJson<MiGenteVeResponse>(this.buildUrl(query), { timeoutMs: 10000 });
      const results = parseMiGenteVeResponse(data);
      console.log(`[MiGenteVeAdapter] Extracted ${results.length} results`);
      return results;
    } catch {
      console.error('[MiGenteVeAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
