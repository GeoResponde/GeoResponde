import fs from 'fs';
import path from 'path';
import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { createAdapter } from '../adapters/registry.js';
import { isCedula, normalizeCedula } from '../adapters/person.js';

export class ProviderGateway {
  private providers: HumanitarianProvider[] = [];
  private adapters: Map<string, BaseAdapter> = new Map();

  async initialize() {
    // Load from catalog
    // In production, this would read from the static output public/catalog/providers.json
    // For this dev environment, we can read it from the public/catalog directory
    const catalogPath = path.resolve(process.cwd(), '../public/catalog/providers.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf8');
      this.providers = JSON.parse(content);
      
      for (const p of this.providers) {
        if (p.status !== 'active') continue;

        const adapter = createAdapter(p);
        if (adapter) {
          this.adapters.set(p.id, adapter);
        } else {
          console.warn(`[Gateway] No adapter registered for provider "${p.id}" (adapter: "${p.adapter}"). Skipping.`);
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
    const results = resultsArray.flat();

    // Cédula search: when the query is a national ID, providers whose text
    // search accepts the number return the person; keep only exact cédula
    // matches (by digits) so the result set is precise. Masked cédulas that
    // cannot be compared in full are dropped from a cédula search.
    if (isCedula(query)) {
      const target = normalizeCedula(query);
      return results.filter(
        (r) => r.person?.cedula && normalizeCedula(r.person.cedula) === target,
      );
    }

    return results;
  }

  getProviders() {
    return this.providers;
  }

  /**
   * Diagnostic helper for the `/api/dev/inspect/:id` developer endpoint.
   * Runs a single provider's adapter in isolation and reports what came back,
   * so contributors can verify a new integration without booting the whole UI.
   */
  async inspect(providerId: string, query: string) {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      return {
        providerId,
        status: 'not_found' as const,
        error: `No active adapter registered for provider id "${providerId}".`,
        activeProviders: [...this.adapters.keys()],
      };
    }

    const startedAt = Date.now();
    try {
      const results = await adapter.search(query);
      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'ok' as const,
        normalizedResults: results.length,
        elapsedMs: Date.now() - startedAt,
        sample: results.slice(0, 3),
      };
    } catch (err: any) {
      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'error' as const,
        elapsedMs: Date.now() - startedAt,
        error: err?.message ?? String(err),
      };
    }
  }
}
