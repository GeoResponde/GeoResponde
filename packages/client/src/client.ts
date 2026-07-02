import type { CatalogData, Organization, Source, Dataset, Layer, SearchIndexEntry } from '@georesponde/catalog';
import type { HumanitarianProvider } from '@georesponde/shared';

export interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class GeoRespondeClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: ClientOptions = {}) {
    // Default to a relative path assuming it's hosted alongside the static catalog
    this.baseUrl = options.baseUrl?.replace(/\/$/, '') || '/catalog';
    
    // Allow injecting a custom fetch function (useful for tests or Node environments without global fetch)
    this.fetchFn = options.fetch || (typeof globalThis !== 'undefined' && globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined as any);

    if (!this.fetchFn) {
      throw new Error('A global fetch API was not found. Please provide a custom fetch implementation in ClientOptions.');
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  public async getCatalog(): Promise<CatalogData> {
    return this.get<CatalogData>('/catalog.json');
  }

  public async getOrganizations(): Promise<Organization[]> {
    return this.get<Organization[]>('/organizations.json');
  }

  public async getSources(): Promise<Source[]> {
    return this.get<Source[]>('/sources.json');
  }

  public async getDatasets(): Promise<Dataset[]> {
    return this.get<Dataset[]>('/datasets.json');
  }

  public async getLayers(): Promise<Layer[]> {
    return this.get<Layer[]>('/layers.json');
  }

  public async getSearchIndex(): Promise<SearchIndexEntry[]> {
    return this.get<SearchIndexEntry[]>('/search-index.json');
  }

  public async getLayer(id: string): Promise<Layer | undefined> {
    const layers = await this.getLayers();
    return layers.find(l => l.id === id);
  }

  public async getProviders(): Promise<HumanitarianProvider[]> {
    return this.get<HumanitarianProvider[]>('/providers.json');
  }
}
