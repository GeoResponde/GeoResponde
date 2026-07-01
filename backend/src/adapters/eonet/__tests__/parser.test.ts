import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { COUNTRY_BBOX, bboxToEonetParam } from '@georesponde/shared';
import { firstDate, toSortedFeatureCollection } from '../parser.js';

const fixturePath = path.join(__dirname, '../fixtures/events.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

describe('EONET parser — firstDate', () => {
  it('returns the single geometry date for a single-point event', () => {
    const flood = fixture.events.find((e: { id: string }) => e.id === 'SYN_FLOOD_01');
    expect(firstDate(flood)).toBe('2026-01-15T20:00:00Z');
  });

  it('returns the earliest date for a multi-point track (not array order)', () => {
    const storm = fixture.events.find((e: { id: string }) => e.id === 'SYN_STORM_02');
    // Array-order first entry is 2026-05-12; earliest is 2026-05-10.
    expect(firstDate(storm)).toBe('2026-05-10T06:00:00Z');
  });

  it('returns empty string when there is no usable geometry date', () => {
    expect(firstDate({ geometry: [] })).toBe('');
    expect(firstDate({})).toBe('');
  });
});

describe('EONET parser — toSortedFeatureCollection', () => {
  const fc = toSortedFeatureCollection(fixture);

  it('produces a GeoJSON FeatureCollection', () => {
    expect(fc.type).toBe('FeatureCollection');
    expect(Array.isArray(fc.features)).toBe(true);
    expect(fc.features.every((f) => f.type === 'Feature')).toBe(true);
    expect(fc.features.every((f) => f.geometry.type === 'Point')).toBe(true);
  });

  it('excludes the dead earthquakes category', () => {
    expect(fc.features.some((f) => f.properties.category === 'earthquakes')).toBe(false);
    expect(fc.features.some((f) => f.properties.id === 'SYN_QUAKE_DEAD')).toBe(false);
    // 4 fixture events, 1 earthquake dropped -> 3 features.
    expect(fc.features).toHaveLength(3);
  });

  it('sorts ascending by firstDate (oldest first, differs from array order)', () => {
    expect(fc.features.map((f) => f.properties.id)).toEqual([
      'SYN_FLOOD_01',
      'SYN_WILDFIRE_03',
      'SYN_STORM_02',
    ]);
    const dates = fc.features.map((f) => f.properties.firstDate);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('collapses a track to the earliest geometry point + its magnitude', () => {
    const storm = fc.features.find((f) => f.properties.id === 'SYN_STORM_02')!;
    expect(storm.geometry.coordinates).toEqual([-63.1, 9.1]);
    expect(storm.properties.magnitude).toBe(40);
    expect(storm.properties.magnitudeUnit).toBe('kts');
  });

  it('reads a Polygon as the first vertex of its first ring', () => {
    const fire = fc.features.find((f) => f.properties.id === 'SYN_WILDFIRE_03')!;
    expect(fire.geometry.coordinates).toEqual([-66.1, 8.2]);
    expect(fire.properties.closed).toBe('2026-03-20T00:00:00Z');
  });

  it('maps source, sourceUrl and open/closed state', () => {
    const flood = fc.features.find((f) => f.properties.id === 'SYN_FLOOD_01')!;
    expect(flood.properties.source).toBe('GDACS');
    expect(flood.properties.sourceUrl).toBe('https://example.test/gdacs/flood-01');
    expect(flood.properties.closed).toBeNull();
    // No magnitude on the flood geometry -> omitted, not null/NaN.
    expect(flood.properties.magnitude).toBeUndefined();
    expect(flood.properties.magnitudeUnit).toBeUndefined();
  });

  it('never throws on malformed input and yields an empty collection', () => {
    expect(toSortedFeatureCollection(null).features).toEqual([]);
    expect(toSortedFeatureCollection({}).features).toEqual([]);
    expect(toSortedFeatureCollection({ events: 'nope' }).features).toEqual([]);
    expect(toSortedFeatureCollection(undefined).features).toEqual([]);
  });

  it('skips individual bad events without dropping good ones', () => {
    const mixed = {
      events: [
        { id: 'no-category', geometry: [{ date: '2026-01-01T00:00:00Z', type: 'Point', coordinates: [-66, 9] }] },
        { id: 'no-geometry', categories: [{ id: 'floods' }] },
        { id: 'bad-coords', categories: [{ id: 'floods' }], geometry: [{ date: '2026-01-01T00:00:00Z', type: 'Point', coordinates: [999, 9] }] },
        { id: 'good', categories: [{ id: 'floods' }], sources: [{ id: 'X', url: 'u' }], geometry: [{ date: '2026-01-01T00:00:00Z', type: 'Point', coordinates: [-66, 9] }] },
      ],
    };
    const out = toSortedFeatureCollection(mixed);
    expect(out.features).toHaveLength(1);
    expect(out.features[0].properties.id).toBe('good');
  });
});

describe('country registry (shared)', () => {
  it('COUNTRY_BBOX.VE deep-equals the Venezuela bbox tuple (W,N,E,S)', () => {
    expect(COUNTRY_BBOX.VE).toEqual([-73.4, 12.2, -59.8, 0.6]);
  });

  it('bboxToEonetParam returns the comma-joined EONET string (case-insensitive)', () => {
    expect(bboxToEonetParam('VE')).toBe('-73.4,12.2,-59.8,0.6');
    expect(bboxToEonetParam('ve')).toBe('-73.4,12.2,-59.8,0.6');
  });

  it('returns undefined for an unregistered country', () => {
    expect(bboxToEonetParam('ZZ')).toBeUndefined();
  });
});
