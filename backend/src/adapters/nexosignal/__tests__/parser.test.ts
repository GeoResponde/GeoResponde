import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseNexoSignalResponse } from '../parser.js';

describe('Busca NexoSignal Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/ninos_encontrados.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the synthetic fixture into normalized results', () => {
    const results = parseNexoSignalResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps a full record, marking it as a found minor', () => {
    const [first] = parseNexoSignalResponse(fixture);

    expect(first.provider).toBe('Busca NexoSignal');
    expect(first.provider_id).toBe('101');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Nino Prueba Uno');
    expect(first.subtitle).toBe(
      'Refugio de Ejemplo, zona sintetica · Hospital Ficticio Central · Dice llamarse Nino y buscar a su mama.',
    );
    expect(first.status).toBe('Estable');
    expect(first.last_update).toBe('2020-01-01T10:00:00.000Z');
    expect(first.thumbnail).toBeUndefined();
    expect(first.url).toBe('https://busca.nexosignal.co/');

    expect(first.person).toMatchObject({
      fullName: 'Nino Prueba Uno',
      age: 7,
      status: 'found',
      rawStatus: 'Estable',
      hospital: 'Hospital Ficticio Central',
      lastSeenLocation: 'Refugio de Ejemplo, zona sintetica',
      isMinor: true,
    });
    expect(first.person?.status).toBe('found');
    expect(first.person?.isMinor).toBe(true);

    // The reporter's cédula must never be exposed as the child's cédula.
    expect(first.person?.cedula).toBeUndefined();
    expect(first.metadata).toEqual({
      hospital: 'Hospital Ficticio Central',
      estado_salud: 'Estable',
      quien_reporta: 'Voluntario Falso',
      reporter_cedula: '00000001',
    });
  });

  it('handles null age and present photo on the second record', () => {
    const second = parseNexoSignalResponse(fixture)[1];

    expect(second.title).toBe('Nina Prueba Dos');
    expect(second.person?.age).toBeUndefined();
    expect(second.person?.status).toBe('found');
    expect(second.person?.isMinor).toBe(true);
    expect(second.thumbnail).toBe('https://example.com/foto-sintetica.jpg');
    expect(second.person?.photoUrl).toBe('https://example.com/foto-sintetica.jpg');
  });

  it('returns an empty array when input is missing or not an array', () => {
    expect(parseNexoSignalResponse(undefined)).toEqual([]);
    expect(parseNexoSignalResponse(null)).toEqual([]);
    expect(parseNexoSignalResponse({} as any)).toEqual([]);
    expect(parseNexoSignalResponse('nope' as any)).toEqual([]);
  });

  it('builds subtitle from only the non-empty parts', () => {
    const results = parseNexoSignalResponse([
      { id: 5, nombre: 'Solo Ubicacion', encontrado_en: 'Plaza Ejemplo' },
    ]);
    expect(results[0].subtitle).toBe('Plaza Ejemplo');
  });
});
