import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcopioVenezuelaAyudaAdapter } from '../adapter.js';
import * as restClient from '../../../transports/rest/client.js';

describe('AcopioVenezuelaAyudaAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should use the VolatileTtlCache and prevent duplicate fetch calls', async () => {
    const fetchSpy = vi.spyOn(restClient, 'fetchJson').mockResolvedValue([
      { 'Quién': 'Test Center' }
    ]);

    const adapter = new AcopioVenezuelaAyudaAdapter({
      id: 'test-provider',
      adapter: 'AcopioVenezuelaAyudaAdapter',
      display_name: 'Test',
      status: 'active',
      capabilities: ['search'],
      config: { url: 'http://example.com' },
      metadata: { cacheTtlMs: 5000 }
    });

    // First call should fetch
    const results1 = await adapter.search('');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results1).toHaveLength(1);
    expect(results1[0].title).toBe('Test Center');

    // Second call should hit cache
    const results2 = await adapter.search('');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results2).toHaveLength(1);
  });
});
