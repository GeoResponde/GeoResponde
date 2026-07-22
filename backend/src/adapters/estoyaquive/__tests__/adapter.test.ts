import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstoyAquiVeAdapter } from '../adapter.js';
import * as restClient from '../../../transports/rest/client.js';
import buscarFixture from '../fixtures/buscar.json';

vi.mock('../../../transports/rest/client.js', () => ({
  fetchJson: vi.fn(),
}));

describe('EstoyAquiVeAdapter', () => {
  const mockConfig = {
    id: 'prov-estoyaquive',
    display_name: 'Estoy Aquí Ve',
    website: 'https://estoyaquive.up.railway.app',
    description: '',
    logo: '',
    status: 'active' as const,
    adapter: 'EstoyAquiVeAdapter',
    capabilities: ['search', 'person lookup'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and normalizes data successfully', async () => {
    vi.mocked(restClient.fetchJson).mockImplementation(async (url: string) => {
      if (url.includes('buscar')) return buscarFixture;
      return [];
    });

    const adapter = new EstoyAquiVeAdapter(mockConfig);
    const results = await adapter.search('');

    expect(results).toHaveLength(4); // 2 missing + 2 found
    expect(restClient.fetchJson).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles fetch errors', async () => {
    vi.mocked(restClient.fetchJson).mockRejectedValue(new Error('Network Error'));

    const adapter = new EstoyAquiVeAdapter(mockConfig);
    const results = await adapter.search('');

    // Should return empty array instead of throwing
    expect(results).toHaveLength(0);
  });

  it('throws error on submit', async () => {
    const adapter = new EstoyAquiVeAdapter(mockConfig);
    await expect(adapter.submit({} as any)).rejects.toThrow(
      'Estoy Aquí Ve does not support submission'
    );
  });
});
