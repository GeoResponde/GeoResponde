import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseUsersResponse, JsonPlaceholderUser } from './parser.js';

const API_BASE = 'https://jsonplaceholder.typicode.com/users';

/**
 * Reference adapter demonstrating the provider SDK end to end (SDK-04). It
 * hits a stable, keyless public demo API (JSONPlaceholder) instead of a real
 * humanitarian source, and exists purely as a worked, runnable example for
 * contributors following `docs/providers/sdk-reference.md`. Registered with
 * `status: 'reference'` so it is never mistaken for a real data source.
 */
export class ExampleReferenceAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  private buildUrl(query: string): string {
    const url = new URL(API_BASE);
    // JSONPlaceholder ignores unknown query params server-side, but we send
    // `q` anyway to mirror the name-search shape a real provider would expose.
    if (query) url.searchParams.set('q', query);
    return url.toString();
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[ExampleReferenceAdapter] Fetching users for query: "${query}"`);
      const data = await fetchJson<JsonPlaceholderUser[]>(this.buildUrl(query), { timeoutMs: 8000 });
      const results = parseUsersResponse(data);
      console.log(`[ExampleReferenceAdapter] Extracted ${results.length} results for query: "${query}"`);
      return results;
    } catch (error) {
      console.error('[ExampleReferenceAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
