import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseApoyoSaluResponse, normalizeItem } from '../parser.js';

describe('ApoyoSalu Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/missing-persons.json');
  const response = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('normalizes every item in the API response', () => {
    const results = parseApoyoSaluResponse(response);
    expect(results).toHaveLength(2);
  });

  it('maps core fields into the normalized shape', () => {
    const [first] = parseApoyoSaluResponse(response);
    expect(first.provider).toBe('Apoyo');
    expect(first.provider_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Ana Prueba');
    expect(first.status).toBe('Desaparecido');
    expect(first.last_update).toBe('2026-06-15T12:30:00.000+00:00');
    expect(first.url).toBe('https://apoyo.salu.pro/');
    expect(first.metadata).toEqual({ cedula: '00000001', edad: 34, genero: 'Femenino' });
  });

  it('joins location and extra info into the subtitle', () => {
    const [first] = parseApoyoSaluResponse(response);
    expect(first.subtitle).toBe('Plaza Ejemplo · Vestia chaqueta azul de prueba');
  });

  it('builds the public thumbnail URL from the first image storage path', () => {
    const [first] = parseApoyoSaluResponse(response);
    expect(first.thumbnail).toBe(
      'https://qgalaewrpqvdpfuuwlrs.supabase.co/storage/v1/object/public/missing-persons-images/00000000-0000-0000-0000-000000000001/photo.webp',
    );
  });

  it('falls back to created_at and omits the thumbnail when there is no image', () => {
    const [, second] = parseApoyoSaluResponse(response);
    expect(second.title).toBe('Luis Ejemplo');
    expect(second.last_update).toBe('2026-05-20T08:00:00.000+00:00');
    expect(second.thumbnail).toBeUndefined();
    expect(second.subtitle).toBe('Avenida Ficticia');
  });

  it('trims a missing apellido out of the title', () => {
    const result = normalizeItem({ id: 'x', nombre: 'Ana' });
    expect(result.title).toBe('Ana');
    expect(result.url).toBe('https://apoyo.salu.pro/');
  });

  it('returns an empty array for malformed responses', () => {
    expect(parseApoyoSaluResponse({} as never)).toEqual([]);
    expect(parseApoyoSaluResponse({ items: undefined })).toEqual([]);
  });
});
