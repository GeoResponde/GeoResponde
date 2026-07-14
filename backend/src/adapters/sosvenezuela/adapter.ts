import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseSosVenezuelaResponse, SosVenezuelaResponse, SosVenezuelaItem } from './parser.js';

const API_BASE = 'https://sosvenezuela2026.com/api/persons/list';

export class SosVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[SosVenezuelaAdapter] Fetching data`);

      const url = `${API_BASE}?q=${encodeURIComponent(query)}&limit=20`;
      const response = await fetchJson<SosVenezuelaResponse | SosVenezuelaItem[]>(url, {
        timeoutMs: 10000,
      });

      const normalizedResults = parseSosVenezuelaResponse(response);

      console.log(
        `[SosVenezuelaAdapter] Extracted ${normalizedResults.length} normalized results`,
      );

      return normalizedResults;
    } catch {
      console.error('[SosVenezuelaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
