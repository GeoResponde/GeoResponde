import { describe, it, expect } from 'vitest';
import type { SituationFeature, SituationFeatureCollection } from '@georesponde/shared';
import {
  EONET_CATEGORIES,
  CATEGORY_COLORS,
  toRenderCollection,
  appearanceRange,
} from './eonet';

function feature(
  id: string,
  category: string,
  firstDate: string,
  coordinates: [number, number] = [-66.9, 10.5],
): SituationFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      id,
      title: `Event ${id}`,
      category,
      source: 'GDACS',
      sourceUrl: 'https://example.org/e/' + id,
      firstDate,
      closed: null,
    },
  };
}

function collection(features: SituationFeature[]): SituationFeatureCollection {
  return { type: 'FeatureCollection', features };
}

describe('EONET_CATEGORIES', () => {
  it('is exactly the five live, Venezuela-relevant ids (no earthquakes)', () => {
    expect([...EONET_CATEGORIES]).toEqual([
      'floods',
      'wildfires',
      'severeStorms',
      'volcanoes',
      'landslides',
    ]);
    expect(EONET_CATEGORIES).not.toContain('earthquakes');
  });
});

describe('CATEGORY_COLORS', () => {
  it('has a distinct hex color for each of the five categories', () => {
    const colors = EONET_CATEGORIES.map((c) => CATEGORY_COLORS[c]);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(new Set(colors).size).toBe(EONET_CATEGORIES.length);
  });
});

describe('toRenderCollection', () => {
  it('returns an empty FeatureCollection for an empty input (no throw)', () => {
    expect(toRenderCollection(collection([]))).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('returns an empty FeatureCollection for null/undefined input', () => {
    expect(toRenderCollection(null)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(toRenderCollection(undefined)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('keeps original properties and adds finite firstDateEpoch + 0-based sequence', () => {
    const input = collection([
      feature('a', 'floods', '2026-01-01T00:00:00Z'),
      feature('b', 'wildfires', '2026-02-01T00:00:00Z'),
    ]);
    const out = toRenderCollection(input);
    expect(out.features).toHaveLength(2);

    expect(out.features[0].properties.id).toBe('a');
    expect(out.features[0].properties.category).toBe('floods');
    expect(out.features[0].properties.source).toBe('GDACS');
    expect(out.features[0].properties.firstDateEpoch).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(Number.isFinite(out.features[0].properties.firstDateEpoch)).toBe(true);
    expect(out.features[0].properties.sequence).toBe(0);

    expect(out.features[1].properties.id).toBe('b');
    expect(out.features[1].properties.firstDateEpoch).toBe(Date.parse('2026-02-01T00:00:00Z'));
    expect(out.features[1].properties.sequence).toBe(1);

    // geometry preserved
    expect(out.features[0].geometry).toEqual({ type: 'Point', coordinates: [-66.9, 10.5] });
  });

  it('drops only the feature whose firstDate is unparseable', () => {
    const input = collection([
      feature('good1', 'floods', '2026-01-01T00:00:00Z'),
      feature('bad', 'volcanoes', 'not-a-date'),
      feature('good2', 'landslides', '2026-03-01T00:00:00Z'),
    ]);
    const out = toRenderCollection(input);
    expect(out.features.map((f) => f.properties.id)).toEqual(['good1', 'good2']);
    // sequence is re-based over the kept features
    expect(out.features.map((f) => f.properties.sequence)).toEqual([0, 1]);
  });
});

describe('appearanceRange', () => {
  it('returns { min: null, max: null } for an empty list (no throw)', () => {
    expect(appearanceRange([])).toEqual({ min: null, max: null });
  });

  it('returns min === max for a single feature', () => {
    const out = toRenderCollection(
      collection([feature('solo', 'floods', '2026-05-01T00:00:00Z')]),
    );
    const e = Date.parse('2026-05-01T00:00:00Z');
    expect(appearanceRange(out.features)).toEqual({ min: e, max: e });
  });

  it('returns the smallest and largest firstDateEpoch across features', () => {
    const out = toRenderCollection(
      collection([
        feature('a', 'floods', '2026-01-01T00:00:00Z'),
        feature('b', 'wildfires', '2026-06-01T00:00:00Z'),
        feature('c', 'volcanoes', '2026-03-01T00:00:00Z'),
      ]),
    );
    expect(appearanceRange(out.features)).toEqual({
      min: Date.parse('2026-01-01T00:00:00Z'),
      max: Date.parse('2026-06-01T00:00:00Z'),
    });
  });
});
