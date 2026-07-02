import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { toEarthquakeCollection, FUNVISIS_ATTRIBUTION } from '../parser.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/sismos.json'), 'utf8'),
);

describe('toEarthquakeCollection — SismosVE normalization', () => {
  it('normalizes usable features and drops unreadable coordinates', () => {
    const c = toEarthquakeCollection(fixture);
    expect(c.features.map((f) => f.properties.id)).toEqual(['syn_fv_001', 'syn_fv_002']);
  });

  it('coerces string value→mag, depth "12.0 km"→12, and DD-MM-YYYY date→epoch', () => {
    const c = toEarthquakeCollection(fixture);
    const f = c.features[0];
    expect(f.geometry.coordinates).toEqual([-68.9, 10.5]);
    expect(f.properties.mag).toBe(3.8);
    expect(f.properties.place).toContain('Barquisimeto');
    expect(f.properties.depth).toBe(12.0);
    expect(typeof f.properties.time).toBe('number');
    // SismosVE times are Venezuela local (UTC-4), pinned explicitly so the epoch
    // is independent of the host TZ.
    expect(f.properties.time).toBe(Date.parse('2026-06-30T14:32:00-04:00'));
  });

  it('tags every feature with the required FUNVISIS (vía SismosVE) attribution', () => {
    const c = toEarthquakeCollection(fixture);
    expect(c.features.every((f) => f.properties.source === FUNVISIS_ATTRIBUTION)).toBe(true);
  });

  it('strips non-http(s) urls (blocks javascript:)', () => {
    const c = toEarthquakeCollection(fixture);
    const f = c.features.find((x) => x.properties.id === 'syn_fv_002');
    expect(f?.properties.url).toBeUndefined();
  });

  it('accepts a `sismos`-nested array too', () => {
    const c = toEarthquakeCollection({ sismos: fixture.features });
    expect(c.features).toHaveLength(2);
  });

  it('never throws on garbage input', () => {
    expect(toEarthquakeCollection(null)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(toEarthquakeCollection({ features: 'nope' })).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
