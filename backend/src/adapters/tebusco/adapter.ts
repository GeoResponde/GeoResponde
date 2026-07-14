import { BaseAdapter } from '../BaseAdapter.js';
import type { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { postJson } from '../../transports/rest/postClient.js';
import { parseTeBuscoResponse } from './parser.js';
import type { TeBuscoRecord } from './types.js';

const API_BASE = 'https://tebusco.app/tebusco-portero.php';

export class TeBuscoAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[TeBuscoAdapter] Fetching data for query: "${query}"`);

      // Te Busco returns the entire dataset on a single POST call.
      const response = await postJson<TeBuscoRecord[]>(
        API_BASE,
        { op: 'desaparecidos' },
        { timeoutMs: 15000 }
      );

      if (response.status !== 200 || !response.body) {
        throw new Error(`Unexpected status ${response.status}`);
      }

      // 1. Normalize the entire dataset first, as requested.
      const normalizedAll = parseTeBuscoResponse(response.body);

      // 2. Filter over the normalized model.
      const queryLower = query.toLowerCase().trim();
      if (!queryLower) {
        return normalizedAll; // If empty query, return all (or should we cap? Let's return all).
      }

      const filtered = normalizedAll.filter(res => {
        const titleMatch = res.title?.toLowerCase().includes(queryLower);
        const idMatch = res.provider_id.toLowerCase().includes(queryLower);
        return titleMatch || idMatch;
      });

      console.log(
        `[TeBuscoAdapter] Extracted ${filtered.length} normalized results for query: "${query}"`
      );

      return filtered;
    } catch (error) {
      console.error('[TeBuscoAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    throw new Error('Unsupported capability: TeBuscoAdapter does not support submissions.');
  }
}
