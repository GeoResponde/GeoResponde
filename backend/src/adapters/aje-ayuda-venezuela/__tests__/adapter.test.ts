import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AjeAyudaVenezuelaAdapter } from '../adapter.js';
import * as restClient from '../../../transports/rest/client.js';
import centrosFixture from '../fixtures/search-centros.json';
import donacionesFixture from '../fixtures/search-donaciones.json';

vi.mock('../../../transports/rest/client.js', () => ({
  fetchJson: vi.fn(),
}));

describe('AjeAyudaVenezuelaAdapter', () => {
  const mockConfig = {
    id: 'src-aje-ayuda-venezuela',
    display_name: 'AJE',
    website: 'https://ajevenezuela.org/ayuda-venezuela',
    description: '',
    logo: '',
    status: 'active' as const,
    adapter: 'AjeAyudaVenezuelaAdapter',
    capabilities: ['search'],
    config: {
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-key',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if configuration is missing', () => {
    expect(() => new AjeAyudaVenezuelaAdapter({ ...mockConfig, config: {} }))
      .toThrow('AJE Ayuda Venezuela requires `supabaseUrl` and `supabaseAnonKey`');
  });

  it('fetches and normalizes data successfully', async () => {
    // Mock the two fetchJson calls. The adapter does Promise.all so we
    // need to resolve them based on the URL.
    vi.mocked(restClient.fetchJson).mockImplementation(async (url: string) => {
      if (url.includes('ayuda_centros_acopio')) return centrosFixture;
      if (url.includes('ayuda_donaciones')) return donacionesFixture;
      return [];
    });

    const adapter = new AjeAyudaVenezuelaAdapter(mockConfig);
    const results = await adapter.search('');

    expect(results).toHaveLength(3); // 2 centros + 1 donacion
    expect(restClient.fetchJson).toHaveBeenCalledTimes(2);

    // Verify correct headers were sent
    const fetchCallOpts = vi.mocked(restClient.fetchJson).mock.calls[0][1];
    expect(fetchCallOpts?.headers).toMatchObject({
      apikey: 'mock-key',
      Authorization: 'Bearer mock-key',
      'Range-Unit': 'items',
      Range: '0-99',
    });
  });

  it('gracefully handles fetch errors', async () => {
    vi.mocked(restClient.fetchJson).mockRejectedValue(new Error('Network Error'));

    const adapter = new AjeAyudaVenezuelaAdapter(mockConfig);
    const results = await adapter.search('');

    // Should return empty array instead of throwing
    expect(results).toHaveLength(0);
  });

  it('throws error on submit', async () => {
    const adapter = new AjeAyudaVenezuelaAdapter(mockConfig);
    await expect(adapter.submit({} as any)).rejects.toThrow(
      'AJE Ayuda Venezuela does not support submission'
    );
  });
});
