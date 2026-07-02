import { describe, it, expect } from 'vitest';
import type { SituationFeatureCollection } from '@georesponde/shared';
import { EonetCache } from '../cache.js';

function fc(id: string): SituationFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-66, 9] },
        properties: {
          id,
          title: id,
          category: 'floods',
          source: 'GDACS',
          sourceUrl: 'u',
          firstDate: '2026-01-01T00:00:00Z',
          closed: null,
        },
      },
    ],
  };
}

describe('EonetCache', () => {
  it('returns a value set within the TTL and undefined after it expires', () => {
    const cache = new EonetCache({ ttlMs: 20 });
    cache.set('k', fc('a'));
    expect(cache.get('k')).toEqual(fc('a'));
  });

  it('misses (get) once the TTL has elapsed', () => {
    const cache = new EonetCache({ ttlMs: -1 }); // already expired on set
    cache.set('k', fc('a'));
    expect(cache.get('k')).toBeUndefined();
  });

  it('getStale still returns the last value after TTL expiry', () => {
    const cache = new EonetCache({ ttlMs: -1 });
    cache.set('k', fc('a'));
    expect(cache.get('k')).toBeUndefined();
    expect(cache.getStale('k')).toEqual(fc('a'));
  });

  it('returns undefined for a never-set key', () => {
    const cache = new EonetCache();
    expect(cache.get('nope')).toBeUndefined();
    expect(cache.getStale('nope')).toBeUndefined();
  });

  it('is bounded: evicts the oldest key past maxEntries', () => {
    const cache = new EonetCache({ maxEntries: 2 });
    cache.set('a', fc('a'));
    cache.set('b', fc('b'));
    cache.set('c', fc('c')); // should evict 'a'
    expect(cache.size).toBe(2);
    expect(cache.getStale('a')).toBeUndefined();
    expect(cache.getStale('b')).toBeDefined();
    expect(cache.getStale('c')).toBeDefined();
  });
});
