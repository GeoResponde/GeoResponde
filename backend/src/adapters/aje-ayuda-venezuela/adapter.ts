import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  SubmissionResult,
} from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseAjeResponse } from './parser.js';
import { AyudaCentroAcopio, AyudaDonacion } from './types.js';

export class AjeAyudaVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
    // @ts-expect-error providerConfig.config is not fully typed yet in the base model
    const config = providerConfig.config || {};
    this.supabaseUrl = config.supabaseUrl;
    this.supabaseAnonKey = config.supabaseAnonKey;

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error(
        'AJE Ayuda Venezuela requires `supabaseUrl` and `supabaseAnonKey` in provider config.'
      );
    }
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[AjeAyudaVenezuelaAdapter] Fetching data for query: "${query}"`);

      const headers = {
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
        'Range-Unit': 'items',
        Range: '0-99', // Basic PostgREST pagination for the first 100 items
      };

      // In a more advanced implementation, we would pass the query down to
      // the PostgREST filters (e.g., &nombre=ilike.*query*). For now, we
      // fetch a reasonable chunk and rely on the gateway to filter the
      // NormalizedSearchResults, adhering to the "Normalize then Filter" pattern.

      const centrosPromise = fetchJson<AyudaCentroAcopio[]>(
        `${this.supabaseUrl}/rest/v1/ayuda_centros_acopio?select=*`,
        { headers, timeoutMs: 8000 }
      );

      const donacionesPromise = fetchJson<AyudaDonacion[]>(
        `${this.supabaseUrl}/rest/v1/ayuda_donaciones?select=*`,
        { headers, timeoutMs: 8000 }
      );

      const [centros, donaciones] = await Promise.all([
        centrosPromise.catch((e) => {
          console.warn(`[AjeAyudaVenezuelaAdapter] Failed to fetch centros:`, e.message);
          return [];
        }),
        donacionesPromise.catch((e) => {
          console.warn(`[AjeAyudaVenezuelaAdapter] Failed to fetch donaciones:`, e.message);
          return [];
        }),
      ]);

      const normalizedResults = parseAjeResponse(centros, donaciones);

      console.log(
        `[AjeAyudaVenezuelaAdapter] Normalized ${normalizedResults.length} total records.`
      );

      return normalizedResults;
    } catch (err) {
      console.error(`[AjeAyudaVenezuelaAdapter] Search error:`, err);
      return [];
    }
  }

  async submit(report: Report, opts?: SubmitOptions): Promise<SubmissionResult> {
    throw new Error(
      'AJE Ayuda Venezuela does not support submission through GeoResponde.'
    );
  }
}
