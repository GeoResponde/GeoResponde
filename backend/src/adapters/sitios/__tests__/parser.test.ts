import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { toAidSiteCollection } from '../parser.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/sitios.json'), 'utf8'),
);

describe('sitios parser — toAidSiteCollection', () => {
  const fc = toAidSiteCollection(fixture);

  it('produces a GeoJSON Point FeatureCollection', () => {
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.every((f) => f.type === 'Feature')).toBe(true);
    expect(fc.features.every((f) => f.geometry.type === 'Point')).toBe(true);
  });

  it('drops sites without usable coordinates (null or out-of-range)', () => {
    // syn-003 (null coords) and syn-004 (lat 999) must be dropped.
    expect(fc.features).toHaveLength(2);
    const ids = fc.features.map((f) => f.properties.id);
    expect(ids).toEqual(['sitio-syn-001', 'sitio-syn-002']);
  });

  it('maps [lng, lat] and the rich site properties', () => {
    const acopio = fc.features.find((f) => f.properties.id === 'sitio-syn-001')!;
    expect(acopio.geometry.coordinates).toEqual([-66.9036, 10.4806]);
    expect(acopio.properties.tipo).toBe('acopio');
    expect(acopio.properties.nombre).toBe('Centro de Acopio Sintetico');
    expect(acopio.properties.estado_operativo).toBe('operativo');
    expect(acopio.properties.necesidades).toEqual(['agua', 'medicinas']);
    expect(acopio.properties.frescura).toBe('reciente');
    expect(acopio.properties.fichaUrl).toBe(
      'https://venezuelareporta.org/sitios/sitio-syn-001',
    );
  });

  it('tags every feature with the Venezuela Reporta attribution', () => {
    expect(fc.features.every((f) => f.properties.source === 'Venezuela Reporta')).toBe(true);
  });

  it('whitelists tipo to the known set, falling back to otro', () => {
    expect(fc.features.every((f) => ['acopio', 'clinica', 'hospital', 'refugio', 'otro'].includes(f.properties.tipo))).toBe(true);
  });

  it('always yields necesidades as an array (empty when none)', () => {
    const refugio = fc.features.find((f) => f.properties.id === 'sitio-syn-002')!;
    expect(refugio.properties.necesidades).toEqual([]);
  });

  it('never throws on malformed input and returns an empty collection', () => {
    expect(toAidSiteCollection(null).features).toEqual([]);
    expect(toAidSiteCollection({}).features).toEqual([]);
    expect(toAidSiteCollection({ sitios: 'nope' }).features).toEqual([]);
  });
});
