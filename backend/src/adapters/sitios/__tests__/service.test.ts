import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildSitiosUrl, fetchAidSites } from '../service.js';
import { SitiosCache } from '../cache.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/sitios.json'), 'utf8'),
);

function deps(fetchImpl: ReturnType<typeof vi.fn>) {
  return { cache: new SitiosCache(), fetchJson: fetchImpl as never };
}

describe('buildSitiosUrl — param encoding', () => {
  it('returns the bare endpoint with no params', () => {
    expect(buildSitiosUrl()).toBe('https://venezuelareporta.org/api/v1/sitios');
  });

  it('encodes tipo and municipio filters', () => {
    const url = buildSitiosUrl({ tipo: 'acopio', municipio: 'San Cristóbal' });
    expect(url).toContain('tipo=acopio');
    expect(url).toContain('municipio=San+Crist%C3%B3bal');
  });
});

describe('fetchAidSites', () => {
  it('normalizes the fixture and reports source=live on a miss', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const result = await fetchAidSites({ tipo: 'acopio' }, deps(fetchJson));
    expect(result.source).toBe('live');
    expect(result.collection.features).toHaveLength(2);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cache hit without a second upstream fetch', async () => {
    const fetchJson = vi.fn().mockResolvedValue(fixture);
    const shared = deps(fetchJson);
    await fetchAidSites({}, shared);
    const second = await fetchAidSites({}, shared);
    expect(second.source).toBe('cache');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('degrades to stale cache when the upstream later fails', async () => {
    const cache = new SitiosCache();
    const ok = vi.fn().mockResolvedValue(fixture);
    await fetchAidSites({}, { cache, fetchJson: ok as never });
    // Force expiry so the next call misses the fresh cache and hits the network.
    const expired = new SitiosCache({ ttlMs: -1 });
    // Prime the stale-capable cache then fail.
    await fetchAidSites({}, { cache: expired, fetchJson: ok as never });
    const fail = vi.fn().mockRejectedValue(new Error('down'));
    const result = await fetchAidSites({}, { cache: expired, fetchJson: fail as never });
    expect(result.source).toBe('cache');
    expect(result.collection.features).toHaveLength(2);
  });

  it('returns an empty collection when upstream fails with no cache', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('down'));
    const result = await fetchAidSites({}, deps(fail));
    expect(result.source).toBe('empty');
    expect(result.collection.features).toEqual([]);
  });
});
