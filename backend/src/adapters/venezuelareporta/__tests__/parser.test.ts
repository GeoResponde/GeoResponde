import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseVenezuelaReportaResponse } from '../parser.js';

describe('VenezuelaReporta Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/personas.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('maps every persona in the envelope', () => {
    const results = parseVenezuelaReportaResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps all fields for a fully populated persona', () => {
    const results = parseVenezuelaReportaResponse(fixture);
    const ana = results.find((r) => r.provider_id === 'ejemplo-1');

    expect(ana).toBeDefined();
    expect(ana?.provider).toBe('Venezuela Reporta');
    expect(ana?.type).toBe('person');
    expect(ana?.title).toBe('Ana Prueba');
    expect(ana?.status).toBe('buscando');
    expect(ana?.subtitle).toBe('Ciudad Ejemplo · Zona Norte · Descripcion sintetica de prueba');
    expect(ana?.last_update).toBe('2026-06-30T12:00:00.000000+00:00');
    expect(ana?.url).toBe('https://venezuelareporta.org/reporte/ejemplo-1');
    expect(ana?.thumbnail).toBeUndefined();
    expect(ana?.metadata).toEqual({
      cedula: '00••••01',
      genero: 'femenino',
      edad: 34,
      verificado: false,
      menor: false,
      origen: null,
    });
    expect(ana?.person).toMatchObject({
      fullName: 'Ana Prueba',
      cedula: '00••••01',
      age: 34,
      gender: 'female',
      status: 'missing',
      rawStatus: 'buscando',
      lastSeenLocation: 'Ciudad Ejemplo, Zona Norte',
      verified: false,
      isMinor: false,
    });
  });

  it('joins only non-empty subtitle parts and omits subtitle when all empty', () => {
    const results = parseVenezuelaReportaResponse(fixture);
    const luis = results.find((r) => r.provider_id === 'ejemplo-2');

    expect(luis).toBeDefined();
    // ciudad present, zona + descripcion null → only the city remains.
    expect(luis?.subtitle).toBe('Ciudad Ejemplo');
    expect(luis?.status).toBe('a_salvo');
    expect(luis?.thumbnail).toBeUndefined();
    expect(luis?.metadata?.menor).toBe(true);
    expect(luis?.metadata?.verificado).toBe(true);
  });

  it('returns [] when personas is missing or not an array', () => {
    expect(parseVenezuelaReportaResponse(undefined)).toEqual([]);
    expect(parseVenezuelaReportaResponse(null)).toEqual([]);
    expect(parseVenezuelaReportaResponse({} as any)).toEqual([]);
    expect(parseVenezuelaReportaResponse({ personas: 'nope' } as any)).toEqual([]);
  });
});
