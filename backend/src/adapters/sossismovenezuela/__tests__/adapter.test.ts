import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SossismoVenezuelaAdapter } from '../adapter.js';
import * as restClient from '../../../transports/rest/client.js';
import centrosFixture from '../fixtures/centros_acorpio_public.json';
import personsFixture from '../fixtures/personas_no_localizadas.json';

vi.mock('../../../transports/rest/client.js', () => ({
  fetchJson: vi.fn(),
}));

describe('SossismoVenezuelaAdapter', () => {
  const mockConfig = {
    id: 'prov-sossismovenezuela',
    display_name: 'SOS Sismo Venezuela',
    website: 'https://sossismovenezuela.com',
    description: '',
    logo: '',
    status: 'active' as const,
    adapter: 'SossismoVenezuelaAdapter',
    capabilities: ['search'],
    config: {
      url: 'https://mock.supabase.co',
      apikey: 'mock-key',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if configuration is missing', () => {
    expect(() => new SossismoVenezuelaAdapter({ ...mockConfig, config: {} }))
      .toThrow('SOS Sismo Venezuela requires `url` and `apikey` in provider config.');
  });

  it('fetches and normalizes data successfully', async () => {
    // Mock the two fetchJson calls. The adapter does Promise.all so we
    // need to resolve them based on the URL.
    vi.mocked(restClient.fetchJson).mockImplementation(async (url: string) => {
      if (url.includes('centros_acopio_public')) return centrosFixture;
      if (url.includes('personas_no_localizadas')) return personsFixture;
      return [];
    });

    const adapter = new SossismoVenezuelaAdapter(mockConfig);
    const results = await adapter.search('');

    expect(results).toHaveLength(4); // 2 centros + 2 personas
    expect(restClient.fetchJson).toHaveBeenCalledTimes(2);

    // Verify correct headers were sent
    const fetchCallOpts = vi.mocked(restClient.fetchJson).mock.calls[0][1];
    expect(fetchCallOpts?.headers).toMatchObject({
      apikey: 'mock-key',
      authorization: 'Bearer mock-key',
    });
  });

  it('gracefully handles fetch errors', async () => {
    vi.mocked(restClient.fetchJson).mockRejectedValue(new Error('Network Error'));

    const adapter = new SossismoVenezuelaAdapter(mockConfig);
    const results = await adapter.search('');

    // Should return empty array instead of throwing
    expect(results).toHaveLength(0);
  });

  it('throws error on submit', async () => {
    const adapter = new SossismoVenezuelaAdapter(mockConfig);
    await expect(adapter.submit({} as any)).rejects.toThrow(
      'SOS Sismo Venezuela does not support submissions'
    );
  });
});
