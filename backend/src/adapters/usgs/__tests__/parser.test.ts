import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { toEarthquakeCollection, USGS_ATTRIBUTION } from '../parser.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/query.json'), 'utf8'),
);

describe('toEarthquakeCollection — USGS normalization', () => {
  it('normalizes usable features and drops unreadable coordinates', () => {
    const c = toEarthquakeCollection(fixture);
    // syn_us_bad_coords dropped (non-numeric coords).
    expect(c.features.map((f) => f.properties.id)).toEqual([
      'syn_us_001',
      'syn_us_002',
      'syn_us_no_mag',
    ]);
  });

  it('maps coordinates to [lon, lat] and captures depth', () => {
    const c = toEarthquakeCollection(fixture);
    const f = c.features[0];
    expect(f.geometry.coordinates).toEqual([-66.8, 10.6]);
    expect(f.properties.depth).toBe(15.2);
    expect(f.properties.mag).toBe(4.2);
    expect(f.properties.place).toContain('Caracas');
  });

  it('tags every feature with the USGS attribution', () => {
    const c = toEarthquakeCollection(fixture);
    expect(c.features.every((f) => f.properties.source === USGS_ATTRIBUTION)).toBe(true);
  });

  it('strips non-http(s) urls (blocks javascript:)', () => {
    const c = toEarthquakeCollection(fixture);
    const f = c.features.find((x) => x.properties.id === 'syn_us_002');
    expect(f?.properties.url).toBeUndefined();
  });

  it('keeps null mag and null time without throwing', () => {
    const c = toEarthquakeCollection(fixture);
    const f = c.features.find((x) => x.properties.id === 'syn_us_no_mag');
    expect(f?.properties.mag).toBeNull();
    expect(f?.properties.time).toBeNull();
  });

  it('never throws on garbage input', () => {
    expect(toEarthquakeCollection(null)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(toEarthquakeCollection({ features: 'nope' })).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
