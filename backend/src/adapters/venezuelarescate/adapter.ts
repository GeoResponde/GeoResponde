import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseVenezuelaRescateResponse } from './parser.js';
import type { MissingItem, HospitalizedItem } from './types.js';

const API_BASE = 'https://rescate.ventatalk.com/api/';

export class VenezuelaRescateAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {

      const missingPromise = fetchJson<MissingItem[]>(
        `${API_BASE}buscar?nombre=${query}`,
        { timeoutMs: 10000 }
      );

      const hospitalizedPromise = fetchJson<HospitalizedItem[]>(
        `${API_BASE}pacientes/buscar?nombre=${query}`,
        { timeoutMs: 10000 }
      );


      const [missing, hospitalized] = await Promise.all([
        missingPromise.catch((e) => {
          console.warn(`[VenezuelaRescateAdapter] Failed to fetch missing:`, e.message);
          return [];
        }),
        hospitalizedPromise.catch((e) => {
          console.warn(`[VenezuelaRescateAdapter] Failed to fetch hospitalized:`, e.message);
          return [];
        }),
      ]);

      const normalizedResults = parseVenezuelaRescateResponse(missing, hospitalized);

      console.log(
        `[VenezuelaRescateAdapter] Extracted ${normalizedResults.length} normalized results`,
      );

      return normalizedResults;
    } catch (error) {

      console.error('[VenezuelaRescateAdapter] Search failed: (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    throw new Error(
      'Venezuela Rescate does not support submission through GeoResponde.'
    );

  }

}
