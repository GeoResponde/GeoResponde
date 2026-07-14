import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseUbicameShard, UbicameRecord } from './parser.js';

/**
 * Federates the static victim registry published by 911.ubica.me.
 *
 * The dataset is sharded into 26 JSON arrays (A–Z) at
 * `https://911.ubica.me/public/data/{LETTER}.json`, partitioned by the first
 * letter of each person's name. A search only needs to fetch the single shard
 * matching the first letter of the query.
 */
export class UbicameAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      const letter = query.trim().charAt(0).toUpperCase();

      // Only alphabetic first letters map to a shard; anything else (digits,
      // punctuation, empty query) has no data to search.
      if (!/[A-Z]/.test(letter)) {
        return [];
      }

      const url = `https://911.ubica.me/public/data/${letter}.json`;
      const records = await fetchJson<UbicameRecord[]>(url, { timeoutMs: 10000 });

      return parseUbicameShard(records, query);
    } catch {
      console.error('[UbicameAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
