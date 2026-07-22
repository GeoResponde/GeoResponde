import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseEstoyAquiVeResponse } from './parser.js';
import { BuscarResponse } from './types.js';

const API_BASE = 'https://estoyaquive.up.railway.app/api/buscar';

export class EstoyAquiVeAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // The /buscar endpoint accepts a 'q' parameter for searching
      const url = `${API_BASE}?q=${encodeURIComponent(query)}`
      const response = await fetchJson<BuscarResponse>(url, { timeoutMs: 10000 });
      const normalizedResults = parseEstoyAquiVeResponse(response);

      console.log(
        `[EstoyAquiVeAdapter] Extracted ${normalizedResults.length} normalized results`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[EstoyAquiVeAdapter] Search failed: (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    throw new Error(
      'Estoy Aquí Ve does not support submission through GeoResponde.'
    );
  }
}
