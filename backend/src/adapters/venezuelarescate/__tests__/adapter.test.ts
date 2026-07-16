import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenezuelaRescateAdapter } from '../adapter.js';
import * as restClient from '../../../transports/rest/client.js';
import missingFixture from '../fixtures/missing.json';
import hospitalizedFixture from '../fixtures/hospitalized.json';

vi.mock('../../../transports/rest/client.js', () => ({
  fetchJson: vi.fn(),
}));

describe('VenezuelaRescateAdapter', () => {
  const mockConfig = {
    id: 'prov-venezuelarescate',
    display_name: 'Venezuela Rescate',
    website: 'https://venezuelarescate.com',
    description: '',
    logo: '',
    status: 'active' as const,
    adapter: 'VenezuelaRescateAdapter',
    capabilities: ['search'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and normalizes data successfully', async () => {
    // Mock the two fetchJson calls. The adapter does Promise.all so we
    // need to resolve them based on the URL.
    vi.mocked(restClient.fetchJson).mockImplementation(async (url: string) => {
      if (url.includes('buscar')) return missingFixture;
      if (url.includes('pacientes/buscar')) return hospitalizedFixture;
      return [];
    });

    const adapter = new VenezuelaRescateAdapter(mockConfig);
    const results = await adapter.search('');

    expect(results).toHaveLength(4); // 2 missing + 2 hospitalized
    expect(restClient.fetchJson).toHaveBeenCalledTimes(2);
  });

  it('gracefully handles fetch errors', async () => {
    vi.mocked(restClient.fetchJson).mockRejectedValue(new Error('Network Error'));

    const adapter = new VenezuelaRescateAdapter(mockConfig);
    const results = await adapter.search('');

    // Should return empty array instead of throwing
    expect(results).toHaveLength(0);
  });

  it('throws error on submit', async () => {
    const adapter = new VenezuelaRescateAdapter(mockConfig);
    await expect(adapter.submit({} as any)).rejects.toThrow(
      'Venezuela Rescate does not support submission'
    );
  });
});
