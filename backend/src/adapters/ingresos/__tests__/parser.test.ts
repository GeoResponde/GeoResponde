import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseIngresosResponse } from '../parser.js';

describe('Ingresos parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/personas.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the synthetic fixture into normalized results', () => {
    const results = parseIngresosResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps all fields and preserves attribution', () => {
    const [first] = parseIngresosResponse(fixture);

    expect(first.provider).toBe('Venezuela Reporta');
    expect(first.provider_id).toBe('ingreso-syn-001');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.subtitle).toBe('Hospital Central Sintetico · Municipio Sintetico');
    expect(first.url).toBe('https://venezuelareporta.org/ingresos/ingreso-syn-001');
    expect(first.last_update).toBe('2026-07-01T08:00:00Z');
    expect(first.person).toMatchObject({
      fullName: 'Ana Prueba',
      cedula: '12••••34',
      age: 40,
      gender: 'female',
      hospital: 'Hospital Central Sintetico',
      lastSeenLocation: 'Hospital Central Sintetico',
      sourceName: 'Cruz Sintetica',
    });
  });

  it('NEVER sets a status (roster appearance does not confirm safety)', () => {
    const results = parseIngresosResponse(fixture);
    for (const r of results) {
      expect(r.status).toBeUndefined();
      expect(r.person?.status).toBeUndefined();
    }
  });

  it('passes a masked cédula through unchanged and tolerates a null cédula', () => {
    const [first, second] = parseIngresosResponse(fixture);
    expect(first.person?.cedula).toBe('12••••34');
    expect(second.person?.cedula).toBeUndefined();
  });

  it('falls back to the VR homepage when ficha_url is absent', () => {
    const [, second] = parseIngresosResponse(fixture);
    expect(second.url).toBe('https://venezuelareporta.org/');
  });

  it('returns an empty array when personas is missing or not an array', () => {
    expect(parseIngresosResponse(undefined)).toEqual([]);
    expect(parseIngresosResponse(null)).toEqual([]);
    expect(parseIngresosResponse({})).toEqual([]);
    expect(parseIngresosResponse({ personas: 'nope' } as never)).toEqual([]);
  });
});
