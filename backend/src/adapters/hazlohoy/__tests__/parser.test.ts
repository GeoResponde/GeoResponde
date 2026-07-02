import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractMarkers, normalizeMarkers } from '../parser.js';

const fixturePath = path.join(__dirname, '../fixtures/rsc-snippet.txt');
const rawFixture = fs.readFileSync(fixturePath, 'utf8');

describe('HazloHoy extractMarkers', () => {
  it('extracts the markers array from an escaped RSC fragment', () => {
    const markers = extractMarkers(rawFixture);
    expect(markers).toHaveLength(2);
    expect(markers[0].id).toBe('missing_00000000-0000-4000-8000-000000000001');
    expect(markers[0].kind).toBe('missing');
    expect(markers[1].kind).toBe('damaged');
    expect(markers[1].title).toBe('Edificio Ejemplo');
  });

  it('returns [] when there is no markers key', () => {
    expect(extractMarkers('no relevant payload here')).toEqual([]);
  });

  it('returns [] on malformed input', () => {
    expect(extractMarkers('\\"markers\\":[{bad json')).toEqual([]);
  });
});

describe('HazloHoy normalizeMarkers', () => {
  const markers = extractMarkers(rawFixture);

  it('maps kind -> type correctly', () => {
    const results = normalizeMarkers(markers);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('person'); // missing -> person
    expect(results[1].type).toBe('building'); // damaged -> building
    expect(results[0].provider).toBe('Hazlo Hoy Terremoto');
    expect(results[0].provider_id).toBe('missing_00000000-0000-4000-8000-000000000001');
  });

  it('maps location as [lng, lat]', () => {
    const results = normalizeMarkers(markers);
    expect(results[0].location).toEqual([-66.9, 10.5]);
    expect(results[1].location).toEqual([-58.38, -34.6]);
  });

  it('resolves relative and absolute hrefs to absolute urls', () => {
    const results = normalizeMarkers(markers);
    expect(results[0].url).toBe('https://terremoto.hazlohoy.org/persona/1');
    expect(results[1].url).toBe('https://terremoto.hazlohoy.org/edificio/2');
  });

  it('carries raw fields into metadata', () => {
    const results = normalizeMarkers(markers);
    expect(results[0].metadata).toMatchObject({
      kind: 'missing',
      source: 'fixture-sintetico',
      approx: false,
      confidence: 0.8,
      color: '#ff0000',
    });
  });

  it('filters by query on title/subtitle (case-insensitive) and caps at 25', () => {
    const byTitle = normalizeMarkers(markers, 'edificio');
    expect(byTitle).toHaveLength(1);
    expect(byTitle[0].title).toBe('Edificio Ejemplo');

    const bySubtitle = normalizeMarkers(markers, 'avenida ejemplo');
    expect(bySubtitle).toHaveLength(1);
    expect(bySubtitle[0].title).toBe('Persona Prueba');

    expect(normalizeMarkers(markers, 'no-match')).toHaveLength(0);
  });

  it('maps kind variants to their normalized types', () => {
    const variants = [
      { id: '1', kind: 'need', title: 't', href: '' },
      { id: '2', kind: 'center', title: 't', href: '' },
      { id: '3', kind: 'helper', title: 't', href: '' },
      { id: '4', kind: 'other', title: 't', href: '' },
    ];
    const results = normalizeMarkers(variants);
    expect(results[0].type).toBe('person'); // need
    expect(results[1].type).toBe('collection_center'); // center
    expect(results[2].type).toBe('resource'); // helper
    expect(results[3].type).toBe('marker'); // fallback
    // empty href falls back to site root
    expect(results[0].url).toBe('https://terremoto.hazlohoy.org/');
    // missing lat/lng -> no location
    expect(results[0].location).toBeUndefined();
  });
});
