import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseBuscaEnListasResponse } from './parser.js';

const BASE_URL = 'https://buscaenlistasvzla.info';

export class BuscaEnListasAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
      const data = await fetchJson<any[]>(url, { timeoutMs: 10000 });
      return parseBuscaEnListasResponse(data);
    } catch {
      console.error('[BuscaEnListasAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
