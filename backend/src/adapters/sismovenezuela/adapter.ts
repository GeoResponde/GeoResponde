import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseSismoVenezuelaFeed } from './parser.js';

const FEED_API = 'https://sismovenezuela.com/api/reports/feed?limit=200';

/**
 * Adapter for sismovenezuela.com, a community platform that aggregates
 * crowdsourced earthquake-damage reports scraped from social media (YouTube / X
 * / Instagram). The feed endpoint has no search parameter, so we fetch the full
 * feed and filter client-side. These results describe damage posts, not people.
 */
export class SismoVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[SismoVenezuelaAdapter] Fetching feed`);
      const data = await fetchJson<unknown>(FEED_API, { timeoutMs: 10000 });
      const results = parseSismoVenezuelaFeed(data, query);
      console.log(
        `[SismoVenezuelaAdapter] Extracted ${results.length} results`,
      );
      return results;
    } catch {
      console.error('[SismoVenezuelaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
