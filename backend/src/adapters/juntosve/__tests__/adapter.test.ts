import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JuntosVeAdapter } from '../adapter.js';
import type { HumanitarianProvider } from '@georesponde/shared';

// Mock the client (must match the exact string used in adapter.ts)
vi.mock('../../../transports/rest/client.js', () => ({
  fetchPostgrestGeoJson: vi.fn(),
}));

import { fetchPostgrestGeoJson } from '../../../transports/rest/client.js';
import pointsFixture from '../fixtures/points.json';

describe('JuntosVeAdapter', () => {
  const provider: HumanitarianProvider = {
    id: 'prov-juntosve',
    display_name: 'Juntos VE',
    website: 'https://juntosve.org',
    description: 'Map',
    logo: 'logo',
    status: 'active',
    adapter: 'JuntosVeAdapter',
    capabilities: ['search'],
    // @ts-expect-error test config injection
    config: {
      url: 'https://api.example.com',
      apikey: 'test-key',
    },
  };

  let adapter: JuntosVeAdapter;

  beforeEach(() => {
    vi.resetAllMocks();
    adapter = new JuntosVeAdapter(provider);
  });

  it('returns empty array if config is missing', async () => {
    const badProvider = { ...provider, config: {} };
    // @ts-expect-error test config
    const badAdapter = new JuntosVeAdapter(badProvider);
    const res = await badAdapter.search();
    expect(res).toEqual([]);
    expect(fetchPostgrestGeoJson).not.toHaveBeenCalled();
  });

  it('fetches and normalizes points', async () => {
    vi.mocked(fetchPostgrestGeoJson).mockResolvedValueOnce(pointsFixture as any);

    const res = await adapter.search();
    expect(fetchPostgrestGeoJson).toHaveBeenCalledWith('https://api.example.com', {
      headers: {
        apikey: 'test-key',
        Authorization: 'Bearer test-key',
      },
    });

    expect(res).toHaveLength(2);
    expect(res[0].provider_id).toBe('7ab79f91-c28e-4f00-908d-39259b2a2a3f');
    expect(res[0].type).toBe('shelter');
    expect(res[1].provider_id).toBe('22b79f91-c28e-4f00-908d-12345b2a2a3f');
    expect(res[1].type).toBe('request');
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetchPostgrestGeoJson).mockRejectedValueOnce(new Error('Network error'));
    const res = await adapter.search();
    expect(res).toEqual([]);
  });

  it('throws on submit', async () => {
    await expect(adapter.submit({})).rejects.toThrow('JuntosVE does not support submission via GeoResponde.');
  });
});
