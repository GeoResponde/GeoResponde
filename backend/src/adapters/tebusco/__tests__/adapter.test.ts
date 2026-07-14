import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeBuscoAdapter } from '../adapter.js';
import { postJson } from '../../../transports/rest/postClient.js';
import type { HumanitarianProvider } from '@georesponde/shared';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('../../../transports/rest/postClient.js', () => ({
  postJson: vi.fn(),
}));

const mockConfig: HumanitarianProvider = {
  id: 'prov-tebusco',
  display_name: 'Te Busco',
  adapter: 'TeBuscoAdapter',
  capabilities: ['search'],
  status: 'active',
  website: 'https://tebusco.app/'
};

describe('Te Busco Adapter', () => {
  const adapter = new TeBuscoAdapter(mockConfig);
  const fixturePath = path.join(__dirname, '../fixtures/desaparecidos.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the full dataset and filters in memory by name', async () => {
    vi.mocked(postJson).mockResolvedValue({ status: 200, body: fixture });

    const results = await adapter.search('carlos');
    
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Carlos Ejemplo');
  });

  it('downloads the full dataset and filters in memory by ID', async () => {
    vi.mocked(postJson).mockResolvedValue({ status: 200, body: fixture });

    const results = await adapter.search('2222');
    
    expect(results).toHaveLength(1);
    expect(results[0].provider_id).toBe('222222222222');
  });

  it('returns all results if query is empty', async () => {
    vi.mocked(postJson).mockResolvedValue({ status: 200, body: fixture });

    const results = await adapter.search('   ');
    expect(results).toHaveLength(2);
  });

  it('handles empty results and search misses gracefully', async () => {
    vi.mocked(postJson).mockResolvedValue({ status: 200, body: fixture });

    const results = await adapter.search('nobody');
    expect(results).toHaveLength(0);
  });

  it('returns an empty array on network failure', async () => {
    vi.mocked(postJson).mockRejectedValue(new Error('Network error'));

    const results = await adapter.search('carlos');
    expect(results).toEqual([]);
  });
  
  it('handles non-200 responses gracefully', async () => {
    vi.mocked(postJson).mockResolvedValue({ status: 500, body: null });

    const results = await adapter.search('carlos');
    expect(results).toEqual([]);
  });

  it('throws an error when submit is called', async () => {
    await expect(adapter.submit({} as any)).rejects.toThrow('Unsupported capability: TeBuscoAdapter does not support submissions.');
  });
});
