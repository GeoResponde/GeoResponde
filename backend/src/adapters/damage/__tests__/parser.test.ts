import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  PRODUCT_TYPE_MAP,
  isAllowedLayerUrl,
  resolveLayerUrls,
  mergeCollections,
  type DamageFeatureCollection,
} from '../parser.js';
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

describe('PRODUCT_TYPE_MAP', () => {
  it('maps public slugs to Copernicus type codes', () => {
    expect(PRODUCT_TYPE_MAP.grading).toBe('GRA');
    expect(PRODUCT_TYPE_MAP['ground-movement']).toBe('GRM');
  });
});

describe('isAllowedLayerUrl — SSRF guard', () => {
  it('allows https on the two Copernicus hosts', () => {
    expect(
      isAllowedLayerUrl(
        'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/x.json',
      ),
    ).toBe(true);
    expect(
      isAllowedLayerUrl('https://rapidmapping.emergency.copernicus.eu/x.json'),
    ).toBe(true);
  });

  it('denies http, other hosts, non-strings and garbage', () => {
    expect(isAllowedLayerUrl('http://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/x.json')).toBe(false);
    expect(isAllowedLayerUrl('https://evil.example.com/steal.json')).toBe(false);
    expect(isAllowedLayerUrl('https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com.evil.com/x')).toBe(false);
    expect(isAllowedLayerUrl(null)).toBe(false);
    expect(isAllowedLayerUrl(42)).toBe(false);
    expect(isAllowedLayerUrl('not a url')).toBe(false);
    expect(isAllowedLayerUrl('')).toBe(false);
  });
});

describe('resolveLayerUrls — version selection + SSRF drop', () => {
  it('selects the highest FINAL version for GRM and drops the decoy host', () => {
    const urls = resolveLayerUrls(activation, 'GRM');
    // v2 (final) wins over v1 (final); decoy on evil.example.com is dropped.
    expect(urls).toEqual([
      'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR884/AOI00/GRM_PRODUCT/EMSR884_AOI00_GRM_PRODUCT_groundMovementA_v2.json',
    ]);
    expect(urls.some((u) => u.includes('evil.example.com'))).toBe(false);
    expect(urls.some((u) => u.includes('_v1.json'))).toBe(false);
  });

  it('resolves the GRA product url from a different AOI', () => {
    const urls = resolveLayerUrls(activation, 'GRA');
    expect(urls).toEqual([
      'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR884/AOI01/GRA_PRODUCT/EMSR884_AOI01_GRA_PRODUCT_builtUpA_v1.json',
    ]);
  });

  it('falls back to the highest available version when no final exists', () => {
    const draftOnly = {
      results: [
        {
          aois: [
            {
              number: 0,
              products: [
                {
                  type: 'GRM',
                  version: { number: 1, statusCode: 'D' },
                  layers: [
                    { format: 'vt', json: 'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/a_v1.json' },
                  ],
                },
                {
                  type: 'GRM',
                  version: { number: 3, statusCode: 'D' },
                  layers: [
                    { format: 'vt', json: 'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/a_v3.json' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(resolveLayerUrls(draftOnly, 'GRM')).toEqual([
      'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/a_v3.json',
    ]);
  });

  it('never picks a lower final over a higher final', () => {
    const urls = resolveLayerUrls(activation, 'GRM');
    expect(urls).not.toContain(
      'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR884/AOI00/GRM_PRODUCT/EMSR884_AOI00_GRM_PRODUCT_groundMovementA_v1.json',
    );
  });

  it('returns [] (never throws) for malformed input', () => {
    expect(resolveLayerUrls(null, 'GRM')).toEqual([]);
    expect(resolveLayerUrls({}, 'GRM')).toEqual([]);
    expect(resolveLayerUrls({ results: 'x' }, 'GRM')).toEqual([]);
    expect(resolveLayerUrls({ results: [{ aois: 'x' }] }, 'GRM')).toEqual([]);
    expect(resolveLayerUrls({ results: [{ aois: [{ products: 'x' }] }] }, 'GRM')).toEqual([]);
    expect(resolveLayerUrls({ results: [{ aois: [{ products: [{ type: 'GRM', layers: 'x' }] }] }] }, 'GRM')).toEqual([]);
  });
});

describe('mergeCollections — pass-through + defensive', () => {
  it('concatenates features from all collections untouched', () => {
    const merged = mergeCollections([grmLayer, graLayer]);
    expect(merged.type).toBe('FeatureCollection');
    expect(merged.features).toHaveLength(4);
    // properties preserved verbatim
    const props = merged.features.map((f) => (f as { properties: Record<string, unknown> }).properties);
    expect(props).toContainEqual({ obj_desc: 'Landslide', value: -42.5 });
    expect(props).toContainEqual({ damage_gra: 'Destroyed' });
  });

  it('drops non-object / non-FeatureCollection inputs and non-object features', () => {
    const merged = mergeCollections([
      null,
      42,
      { type: 'Feature' },
      { type: 'FeatureCollection', features: [{ a: 1 }, null, 'x', 5] },
    ]);
    expect(merged.features).toEqual([{ a: 1 }]);
  });

  it('never throws on garbage input', () => {
    expect(() => mergeCollections(null as never)).not.toThrow();
    expect(mergeCollections(null as never)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(mergeCollections([undefined, {}, []])).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('applies a hard feature cap as a DoS backstop', () => {
    const huge = {
      type: 'FeatureCollection',
      features: Array.from({ length: 250_000 }, (_, i) => ({ id: i })),
    };
    const merged = mergeCollections([huge]);
    expect(merged.features.length).toBeLessThanOrEqual(200_000);
  });
});

describe('DamageCache — shared volatile cache smoke test', () => {
  it('round-trips a DamageFeatureCollection via get/getStale/set', () => {
    const cache = new DamageCache();
    const value: DamageFeatureCollection = { type: 'FeatureCollection', features: [{ a: 1 }] };
    cache.set('k', value);
    expect(cache.get('k')).toEqual(value);
    expect(cache.getStale('k')).toEqual(value);
    expect(cache.get('missing')).toBeUndefined();
  });
});
