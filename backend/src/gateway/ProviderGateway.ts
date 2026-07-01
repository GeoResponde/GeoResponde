import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { VenezuelaTeBuscaAdapter } from '../adapters/venezuelatebusca/adapter.js';
import { TerremotoVenezuelaAdapter } from '../adapters/terremotovenezuela/adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProviderGateway {
  private providers: HumanitarianProvider[] = [];
  private adapters: Map<string, BaseAdapter> = new Map();

  async initialize() {
    // Resolve relative to the location of this file, reaching the monorepo root
    const catalogPath = path.resolve(__dirname, '../../../public/catalog/providers.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf8');
      this.providers = JSON.parse(content);
      
      for (const p of this.providers) {
        if (p.status !== 'active') continue;
        
        if (p.adapter === 'VenezuelaTeBuscaAdapter') {
          this.adapters.set(p.id, new VenezuelaTeBuscaAdapter(p));
        } else if (p.adapter === 'TerremotoVenezuelaAdapter') {
          this.adapters.set(p.id, new TerremotoVenezuelaAdapter(p));
        }
      }
      console.log(`[Gateway] Initialized with ${this.adapters.size} active adapters.`);
    } else {
      console.warn(`[Gateway] Warning: No providers.json found at ${catalogPath}`);
    }
  }

  async search(query: string, domain?: string): Promise<NormalizedSearchResult[]> {
    const searchPromises: Promise<NormalizedSearchResult[]>[] = [];
    
    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.provider.capabilities.includes('search')) {
        searchPromises.push(
          adapter.search(query, domain).catch(e => {
            console.error(`[Gateway] Provider ${id} search failed:`, e);
            return [];
          })
        );
      }
    }

    const resultsArray = await Promise.all(searchPromises);
    return resultsArray.flat();
  }

  getProviders() {
    return this.providers;
  }

  async submit(providerId: string, pkg: SubmissionPackage): Promise<{ success: boolean; referenceId?: string }> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      console.error(`[Gateway] Provider ${providerId} not found or inactive`);
      return { success: false };
    }
    if (!adapter.submit) {
      console.error(`[Gateway] Provider ${providerId} does not support submissions`);
      return { success: false };
    }
    return adapter.submit(pkg);
  }

  async routeSubmission(pkg: SubmissionPackage): Promise<{ success: boolean; referenceId?: string; providerName?: string }> {
    let targetProviderId: string | undefined;

    // For this first iteration, we route building damage reports to TerremotoVenezuela.
    // In the future, this can be dynamic based on provider capabilities.
    if (pkg.type === 'building_damage') {
      targetProviderId = 'prov-terremotovenezuela';
    }

    if (!targetProviderId) {
      console.error(`[Gateway] No provider found for submission type: ${pkg.type}`);
      return { success: false };
    }

    const adapter = this.adapters.get(targetProviderId);
    if (!adapter) {
      console.error(`[Gateway] Provider ${targetProviderId} not found or inactive`);
      return { success: false };
    }
    if (!adapter.submit) {
      console.error(`[Gateway] Provider ${targetProviderId} does not support submissions`);
      return { success: false };
    }

    const result = await adapter.submit(pkg);
    return {
      ...result,
      providerName: adapter.provider.display_name
    };
  }

  async getGeoJSON(providerId: string): Promise<any> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider ${providerId} not found or inactive`);
    }
    if (!adapter.getGeoJSON) {
      throw new Error(`Provider ${providerId} does not support getGeoJSON`);
    }
    return adapter.getGeoJSON();
  }
}
