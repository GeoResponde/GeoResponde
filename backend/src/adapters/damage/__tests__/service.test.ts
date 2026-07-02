import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildActivationUrl,
  fetchCopernicusProduct,
} from '../service.js';
import { DamageCache } from '../cache.js';

const activation = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/activation-EMSR884.json'), 'utf8'),
);
const grmLayer = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/layer-groundMovement.json'), 'utf8'),
);
const graLayer = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/layer-grading-builtUp.json'), 'utf8'),
);

/**
 * A fetchJson stub that routes by url substring: the activation url returns the
 * activation fixture; GRM/GRA S3 urls return the matching layer fixtures.
 */
function routedFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes('public-activations')) return activation;
    if (url.includes('GRM_PRODUCT') || url.includes('groundMovement')) return grmLayer;
    if (url.includes('GRA_PRODUCT') || url.includes('builtUp')) return graLayer;
    throw new Error(`unexpected url: ${url}`);
  });
}

function deps(fetchImpl: ReturnType<typeof vi.fn>, cache = new DamageCache()) {
  return { cache, fetchJson: fetchImpl as never };
}

describe('buildActivationUrl — activationId validation', () => {
  it('builds the public-activations url with a validated code', () => {
    const url = buildActivationUrl('EMSR884');
    expect(url).toBeDefined();
    expect(url).toContain('public-activations');
    expect(url).toContain('code=EMSR884');
  });

  it('rejects an id not matching /^EMSR\\d+$/', () => {
    expect(buildActivationUrl('../evil')).toBeUndefined();
    expect(buildActivationUrl('EMSR')).toBeUndefined();
    expect(buildActivationUrl('EMSR884; DROP')).toBeUndefined();
  });
});

describe('fetchCopernicusProduct — live path', () => {
  it('resolves grading (GRA) to merged GeoJSON with attribution, source live', async () => {
    const fetchJson = routedFetch();
    const result = await fetchCopernicusProduct('grading', deps(fetchJson));

    expect(result.source).toBe('live');
    expect(result.collection.type).toBe('FeatureCollection');
    expect(result.collection.features).toHaveLength(2);
    expect(result.attribution).toBe('© European Union, 2026, Copernicus EMS (EMSR884)');
    // activation fetch + 1 GRA layer fetch
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('resolves ground-movement (GRM) to merged GeoJSON, source live', async () => {
    const fetchJson = routedFetch();
    const result = await fetchCopernicusProduct('ground-movement', deps(fetchJson));

    expect(result.source).toBe('live');
    expect(result.collection.features).toHaveLength(2);
    const props = result.collection.features.map(
      (f) => (f as { properties: Record<string, unknown> }).properties,
    );
    expect(props).toContainEqual({ obj_desc: 'Landslide', value: -42.5 });
  });
});

describe('fetchCopernicusProduct — caching', () => {
  it('serves a second identical in-TTL request from cache without re-fetching', async () => {
    const fetchJson = routedFetch();
    const shared = deps(fetchJson);

    const first = await fetchCopernicusProduct('grading', shared);
    const second = await fetchCopernicusProduct('grading', shared);

    expect(first.source).toBe('live');
    expect(second.source).toBe('cache');
    expect(second.collection).toEqual(first.collection);
    // only the first call touched the network (activation + layer = 2)
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});

describe('fetchCopernicusProduct — short-circuits (no fetch)', () => {
  it('returns empty for an unknown product WITHOUT fetching', async () => {
    const fetchJson = routedFetch();
    const result = await fetchCopernicusProduct('bogus', deps(fetchJson));

    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
    expect(fetchJson).not.toHaveBeenCalled();
    // attribution still supplied from the current event
    expect(result.attribution).toBe('© European Union, 2026, Copernicus EMS (EMSR884)');
  });

  it('returns empty when the current event has no Copernicus activation', async () => {
    const original = process.env.GR_CURRENT_EVENT;
    process.env.GR_CURRENT_EVENT = 'no-such-event';
    try {
      const fetchJson = routedFetch();
      const result = await fetchCopernicusProduct('grading', deps(fetchJson));
      expect(result.source).toBe('empty');
      expect(result.attribution).toBe('');
      expect(fetchJson).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.GR_CURRENT_EVENT;
      else process.env.GR_CURRENT_EVENT = original;
    }
  });
});

describe('fetchCopernicusProduct — graceful degradation', () => {
  it('degrades to stale cache when upstream fails after a prior success', async () => {
    const fetchJson = vi
      .fn()
      .mockImplementationOnce(async () => activation)
      .mockImplementationOnce(async () => graLayer)
      .mockRejectedValue(new Error('Copernicus down'));
    // ttlMs -1 forces the second call to be a fresh miss that re-fetches and fails.
    const shared = deps(fetchJson, new DamageCache({ ttlMs: -1 }));

    const first = await fetchCopernicusProduct('grading', shared);
    const second = await fetchCopernicusProduct('grading', shared);

    expect(first.source).toBe('live');
    expect(second.source).toBe('cache'); // stale served
    expect(second.collection).toEqual(first.collection);
  });

  it('returns empty (source empty) when upstream fails with no cache', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('Copernicus down'));
    const result = await fetchCopernicusProduct('grading', deps(fetchJson));

    expect(result.source).toBe('empty');
    expect(result.collection).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('never throws on upstream failure', async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      fetchCopernicusProduct('grading', deps(fetchJson)),
    ).resolves.toBeDefined();
  });
});
