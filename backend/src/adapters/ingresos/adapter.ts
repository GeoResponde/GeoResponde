import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseIngresosResponse, IngresosResponse } from './parser.js';

const API_BASE = 'https://venezuelareporta.org/api/v1/ingresos';

/**
 * Search-only adapter for Venezuela Reporta's `/api/v1/ingresos` endpoint — a
 * ~20k-entry hospital-intake roster. Federates through the registry like any
 * other person source; cross-provider dedup collapses duplicates by
 * cédula/name+age. Attribution ("Venezuela Reporta") is preserved on every
 * result, as required by the API terms.
 */
export class IngresosAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // Never log the query — it is a person's name/cédula (PII).
      const url = `${API_BASE}?q=${encodeURIComponent(query)}&limit=10`;
      const response = await fetchJson<IngresosResponse>(url, { timeoutMs: 10000 });

      const normalizedResults = parseIngresosResponse(response);

      console.log(`[IngresosAdapter] Extracted ${normalizedResults.length} normalized results`);

      return normalizedResults;
    } catch {
      console.error('[IngresosAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
