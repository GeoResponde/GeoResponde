import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAyudaVenezuelaResponse } from '../parser.js';

describe('Ayuda Venezuela Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/person_reports_public.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parseAyudaVenezuelaResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps a missing adult record correctly', () => {
    const [first] = parseAyudaVenezuelaResponse(fixture);

    expect(first.provider).toBe('Ayuda Venezuela');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-0000000000a1');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.subtitle).toBe('Sector Sintetico · Municipio Ficticio · Estado Ejemplo');
    expect(first.status).toBe('missing');
    expect(first.last_update).toBe('2020-01-02T10:00:00.000Z');
    expect(first.thumbnail).toBeUndefined();
    expect(first.url).toBe('https://ayudavenezuela.app/directorio');
    expect(first.person).toMatchObject({
      fullName: 'Ana Prueba',
      firstName: 'Ana',
      lastName: 'Prueba',
      age: 34,
      gender: 'female',
      status: 'missing',
      rawStatus: 'missing',
      lastSeenLocation: 'Sector Sintetico, Municipio Ficticio, Estado Ejemplo',
      isMinor: false,
      sourceName: 'Reporte Familiar',
    });
  });

  it('maps a hospitalized minor record and thumbnail correctly', () => {
    const second = parseAyudaVenezuelaResponse(fixture)[1];

    expect(second.title).toBe('Carlos Ejemplo');
    expect(second.status).toBe('in_hospital');
    expect(second.thumbnail).toBe('https://example.com/foto-sintetica.jpg');
    expect(second.person?.status).toBe('hospitalized');
    expect(second.person?.isMinor).toBe(true);
    expect(second.person?.gender).toBe('male');
  });

  it('returns an empty array when input is not an array', () => {
    expect(parseAyudaVenezuelaResponse(undefined)).toEqual([]);
    expect(parseAyudaVenezuelaResponse(null)).toEqual([]);
    expect(parseAyudaVenezuelaResponse({} as any)).toEqual([]);
  });

  it('falls back to search_name then Desconocido for the title', () => {
    const results = parseAyudaVenezuelaResponse([
      { id: 'x', search_name: 'Solo Busqueda' },
      { id: 'y' },
    ]);
    expect(results[0].title).toBe('Solo Busqueda');
    expect(results[1].title).toBe('Desconocido');
  });

  it('falls back to created_at when updated_at is absent', () => {
    const results = parseAyudaVenezuelaResponse([
      { id: 'x', created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(results[0].last_update).toBe('2026-01-01T00:00:00Z');
  });
});
