import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseSossismoVenezuelaResponse } from './parser.js'
import { SossismoVenezuelaPerson, SossismoVenezuelaCenter } from './types.js';

export class SossismoVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  private url: string;
  private apikey: string;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
    // @ts-expect-error config is dynamically injected by the catalog
    const config = providerConfig.config || {}
    this.url = config.url
    this.apikey = config.apikey

    if (!this.url || !this.apikey) {
      throw new Error(
        'SOS Sismo Venezuela requires `url` and `apikey` in provider config.'
      );
    }
  }

  private get authHeaders(): Record<string, string> {
    const key = this.apikey;
    return {
      apikey: key,
      authorization: `Bearer ${key}`,
    };
  }

  private async fetchMissingPersons(query?: string): Promise<SossismoVenezuelaPerson[]> {
    let url = `${this.url}/personas_no_localizadas`;
    let urlParams = new URLSearchParams({
      limit: "20",
      offset: "0",
      select: "id,nombre,apellido,edad,genero,descripcion,venezuelan_id,ultima_ubicacion,ultima_vez_contactado,foto_url,estado,contacto_telefono,contacto_nombre,reporter_email,updated_at,created_at,latitude,longitude,source_name,ciudad,zona",
    })

    if (query) {
      urlParams.append("or", `(nombre.ilike.*${query}*,apellido.ilike.*${query}*,descripcion.ilike.*${query}*,venezuelan_id.ilike.*${query}*)`);
    }

    url += '?' + urlParams.toString();

    try {
      return await fetchJson<SossismoVenezuelaPerson[]>(url, {
        timeoutMs: 10000,
        headers: this.authHeaders,
      });
    } catch (error) {
      console.warn(`[SossismoVenezuelaAdapter] Failed to fetch missing persons:`, error);
      return [];
    }
  }

  private async fetchCenters(query?: string): Promise<SossismoVenezuelaCenter[]> {
    let url = `${this.url}/centros_acopio_public`;
    let urlParams = new URLSearchParams({
      limit: "20",
      offset: "0"
    });


    if (query) {
      urlParams.append("or", `(nombre.ilike.*${query}*,direccion.ilike.*${query}*,ciudad.ilike.*${query}*)`);
    }

    url += "?" + urlParams.toString();

    try {
      return await fetchJson<SossismoVenezuelaCenter[]>(url, {
        timeoutMs: 10000,
        headers: this.authHeaders,
      });
    } catch (error) {
      console.warn(`[SossismoVenezuelaAdapter] Failed to fetch centers:`, error);
      return [];
    }
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      const [missing, centers] = await Promise.all([
        this.fetchMissingPersons(query),
        this.fetchCenters(query),
      ]);

      const normalizedResults = parseSossismoVenezuelaResponse(missing, centers);

      console.log(
        `[SossismoVenezuelaAdapter] Extracted ${normalizedResults.length} normalized results`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[SossismoVenezuelaAdapter] Search failed (network/transport error');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    throw new Error(
      "SOS Sismo Venezuela does not support submissions"
    );
  }
}
