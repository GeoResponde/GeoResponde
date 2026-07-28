import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseSossismoVenezuelaResponse } from '../parser.js';
import type { SossismoVenezuelaPerson, SossismoVenezuelaCenter } from '../types.js';

describe('Sossismo Venezuela Parser', () => {
  const personsFixturePath = path.join(__dirname, '../fixtures/personas_no_localizadas.json');
  const personsFixture: SossismoVenezuelaPerson[] = JSON.parse(
    fs.readFileSync(personsFixturePath, 'utf-8')
  );

  const centersFixturePath = path.join(__dirname, '../fixtures/centros_acorpio_public.json');
  const centersFixture: SossismoVenezuelaCenter[] = JSON.parse(
    fs.readFileSync(centersFixturePath, 'utf-8')
  );

  it('parses missing persons fixture array into normalized results', () => {
    const results = parseSossismoVenezuelaResponse(personsFixture, []);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('person');
    expect(results[1].type).toBe('person');
  });

  it('parses centers fixture array into normalized results', () => {
    const results = parseSossismoVenezuelaResponse([], centersFixture);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('report');
    expect(results[1].type).toBe('report');
  });

  it('parses both persons and centers together', () => {
    const results = parseSossismoVenezuelaResponse(personsFixture, centersFixture);
    expect(results).toHaveLength(4);
    expect(results[0].type).toBe('person');
    expect(results[1].type).toBe('person');
    expect(results[2].type).toBe('report');
    expect(results[3].type).toBe('report');
  });

  it('maps a missing person record correctly', () => {
    const [first] = parseSossismoVenezuelaResponse(personsFixture, []);

    expect(first.provider).toBe('SOS Sismo Venezuela');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-0000000000a1');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.subtitle).toBe('Descripcion sintetica para pruebas.');
    expect(first.status).toBe('missing');
    expect(first.thumbnail).toBeUndefined();
    expect(first.url).toBe('https://sossismovenezuela.com/personas/00000000-0000-0000-0000-0000000000a1');
    expect(first.location).toBeUndefined();

    expect(first.person).toMatchObject({
      fullName: 'Ana Prueba',
      firstName: 'Ana',
      lastName: 'Prueba',
      age: 50,
      gender: 'female',
      status: 'missing',
      rawStatus: 'buscada',
      lastSeenLocation: 'Campo de Golf, Caraballeda',
      description: 'Descripcion sintetica para pruebas.',
      photoUrl: undefined,
      sourceName: "example.com",
    });

    expect(first.metadata).toMatchObject({
      city: 'Caraballeda',
      zone: 'Campo de Golf',
    });
  });

  it('maps a found person record correctly', () => {
    const [, second] = parseSossismoVenezuelaResponse(personsFixture, []);

    expect(second.title).toBe('Carlos Ejemplo');
    expect(second.status).toBe('found');
    expect(second.thumbnail).toBe('https://example.com/foto-sintetica.jpg');
    expect(second.location).toEqual([-66.9583, 10.4708]);
    expect(second.url).toBe('https://sossismovenezuela.com/personas/00000000-0000-0000-0000-0000000000a2');

    expect(second.person?.status).toBe('found');
    expect(second.person?.gender).toBe('male');
    expect(second.person?.sourceName).toBe(undefined);
    expect(second.person?.lastSeenLocation).toBe('Montalban, Caracas');
  });

  it('maps a collection center record correctly', () => {
    const [first] = parseSossismoVenezuelaResponse([], centersFixture);

    expect(first.provider).toBe('SOS Sismo Venezuela');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-0000000000b1');
    expect(first.type).toBe('report');
    expect(first.title).toBe('Fake Collection Center');
    expect(first.subtitle).toBe('Fake Collection Center en Zone I, Municipio Sintetico · Montalban I · Caracas');
    expect(first.status).toBe('verificado');
    expect(first.location).toEqual([-66.9583, 10.4708]);
    expect(first.url).toBe('https://sossismovenezuela.com/centros_acopio_public');

    expect(first.metadata).toMatchObject({
      source: 'some random source',
      city: 'Caracas',
      state: 'Distrito Capital',
      municipality: 'Municipio Sintetico',
      zone: 'Zone I',
      accepted_items: ['Agua potable', 'Alimentos no perecederos', 'Insumos medicos', 'Ropa y abrigos'],
    });
  });

  it('returns an empty array when inputs are not arrays', () => {
    expect(parseSossismoVenezuelaResponse(undefined, undefined)).toEqual([]);
    expect(parseSossismoVenezuelaResponse(null, null)).toEqual([]);
    expect(parseSossismoVenezuelaResponse({}, {})).toEqual([]);
  });

  it('handles missing required fields gracefully', () => {
    const results = parseSossismoVenezuelaResponse(
      [{ id: 'test-1' } as SossismoVenezuelaPerson],
      []
    );
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Desconocido');
    expect(results[0].provider_id).toBe('test-1');
  });
});
