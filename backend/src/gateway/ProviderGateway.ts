import fs from 'fs';
import path from 'path';
import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { createAdapter } from '../adapters/registry.js';

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
    return resultsArray.flat();
  }

  getProviders() {
    return this.providers;
  }
}
