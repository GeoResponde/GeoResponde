import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseEncuentralosResponse } from '../parser.js';

describe('Encuéntralos Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/personas.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the real API fixture into normalized results', () => {
    const results = parseEncuentralosResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps all fields correctly for a record without coordinates', () => {
    const [first] = parseEncuentralosResponse(fixture);

    expect(first.provider).toBe('Encuéntralos');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.subtitle).toBe(
      'Ciudad Ejemplo, municipio de prueba · Descripcion de ejemplo, datos sinteticos.',
    );
    expect(first.status).toBe('desaparecido');
    expect(first.location).toBeUndefined();
    expect(first.last_update).toBe('2020-01-01T10:00:00.000Z');
    expect(first.thumbnail).toBeUndefined();
    expect(first.url).toBe(
      'https://encuentralos.tecnosoft.dev/persona/00000000-0000-0000-0000-000000000001',
    );
    expect(first.metadata).toEqual({ edad: 40, sexo: 'femenino', cedula: '00000001' });
  });

  it('maps coordinates as [lng, lat] and thumbnail when present', () => {
    const results = parseEncuentralosResponse(fixture);
    const second = results[1];

    expect(second.location).toEqual([-66.9, 10.5]);
    expect(second.thumbnail).toBe('https://example.com/foto-ejemplo.jpg');
    expect(second.title).toBe('Carlos Ejemplo');
  });

  it('returns an empty array when items is missing or not an array', () => {
    expect(parseEncuentralosResponse(undefined)).toEqual([]);
    expect(parseEncuentralosResponse(null)).toEqual([]);
    expect(parseEncuentralosResponse({} as any)).toEqual([]);
    expect(parseEncuentralosResponse({ items: 'nope' } as any)).toEqual([]);
  });

  it('falls back to creado when ultima_vez is absent', () => {
    const results = parseEncuentralosResponse({
      items: [{ id: 'x', nombre: 'Test', ultima_vez: null, creado: '2026-01-01T00:00:00Z' }],
    });
    expect(results[0].last_update).toBe('2026-01-01T00:00:00Z');
  });

  it('builds subtitle from only the non-empty parts', () => {
    const results = parseEncuentralosResponse({
      items: [{ id: 'x', nombre: 'Test', ultima_ubicacion: 'Caracas', descripcion: null }],
    });
    expect(results[0].subtitle).toBe('Caracas');
  });
});
