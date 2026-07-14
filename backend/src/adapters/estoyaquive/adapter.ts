import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseEstoyAquiVeResponse } from './parser.js';
import type { BuscarResponse, EncontradasResponse } from './types.js';

const API_BASE = 'https://estoyaquive.up.railway.app/api/';

export class EstoyAquiVeAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // The /buscar endpoint accepts a 'q' parameter for searching
      const missingPromise = fetchJson<BuscarResponse>(
        `${API_BASE}buscar?q=${query}`,
        { timeoutMs: 10000 }
      );

      const foundPromise = fetchJson<EncontradasResponse>(
        `${API_BASE}encontradas?q=${query}&limit=20`,
        { timeoutMs: 10000 }
      );

      const [missing, found] = await Promise.all([
        missingPromise.catch((e) => {
          console.warn(`[EstoyAquiVeAdapter] Failed to fetch missing:`, e.message);
          return null;
        }),
        foundPromise.catch((e) => {
          console.warn(`[EstoyAquiVeAdapter] Failed to fetch found:`, e.message);
          return null;
        }),
      ]);

      const normalizedResults = parseEstoyAquiVeResponse(missing, found);

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
