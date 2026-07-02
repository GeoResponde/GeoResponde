import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseSosVenezuelaResponse } from '../parser.js';

describe('SOS Venezuela 2026 Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/personas.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the (synthetic) array fixture into normalized results', () => {
    const results = parseSosVenezuelaResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps all fields correctly for a seeking_info record', () => {
    const [first] = parseSosVenezuelaResponse(fixture);

    expect(first.provider).toBe('SOS Venezuela 2026');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.subtitle).toBe('Parroquia Ficticia · Edificio de prueba · Municipio Ejemplo');
    expect(first.status).toBe('seeking_info');
    expect(first.last_update).toBe('2020-01-01T10:00:00.000Z');
    expect(first.thumbnail).toBeUndefined();
    expect(first.url).toBe('https://sosvenezuela2026.com/buscar');
    expect(first.metadata).toEqual({
      municipio: 'Municipio Ejemplo',
      parroquia: 'Parroquia Ficticia · Edificio de prueba',
    });
    expect(first.person).toMatchObject({
      fullName: 'Ana Prueba',
      status: 'missing',
      rawStatus: 'seeking_info',
      lastSeenLocation: 'Parroquia Ficticia · Edificio de prueba, Municipio Ejemplo',
      lastSeenAt: '2020-01-01T10:00:00.000Z',
    });
    expect(first.person?.cedula).toBeUndefined();
    expect(first.person?.hospital).toBeUndefined();
    expect(first.person?.photoUrl).toBeUndefined();
  });

  it('maps a found_alive record with photo, hospital and masked cedula', () => {
    const second = parseSosVenezuelaResponse(fixture)[1];

    expect(second.provider_id).toBe('00000000-0000-0000-0000-000000000002');
    expect(second.title).toBe('Carlos Ejemplo');
    expect(second.status).toBe('found_alive');
    expect(second.thumbnail).toBe('https://example.com/foto-ejemplo.jpg');
    expect(second.person).toMatchObject({
      fullName: 'Carlos Ejemplo',
      cedula: '12••••78',
      status: 'safe',
      rawStatus: 'found_alive',
      hospital: 'Hospital Generico',
      photoUrl: 'https://example.com/foto-ejemplo.jpg',
    });
  });

  it('accepts a bare array, a { persons } envelope and an { items } envelope', () => {
    const record = [{ id: 'x', status: 'found_dead', display_name: 'Test' }];
    expect(parseSosVenezuelaResponse(record)).toHaveLength(1);
    expect(parseSosVenezuelaResponse({ persons: record })).toHaveLength(1);
    expect(parseSosVenezuelaResponse({ items: record })).toHaveLength(1);
    expect(parseSosVenezuelaResponse(record)[0].person?.status).toBe('deceased');
  });

  it('returns an empty array when the shape is unrecognized', () => {
    expect(parseSosVenezuelaResponse(undefined)).toEqual([]);
    expect(parseSosVenezuelaResponse(null)).toEqual([]);
    expect(parseSosVenezuelaResponse({} as any)).toEqual([]);
    expect(parseSosVenezuelaResponse({ persons: 'nope' } as any)).toEqual([]);
  });

  it('builds subtitle from only the non-empty location parts', () => {
    const results = parseSosVenezuelaResponse([
      { id: 'x', status: 'seeking_info', display_name: 'Test', municipio: 'Caracas', parroquia: null },
    ]);
    expect(results[0].subtitle).toBe('Caracas');
    expect(results[0].person?.lastSeenLocation).toBe('Caracas');
  });
});
