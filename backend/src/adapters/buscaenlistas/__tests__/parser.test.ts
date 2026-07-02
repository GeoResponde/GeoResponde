import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseBuscaEnListasResponse } from '../parser.js';

describe('BuscaEnListas Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/search.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('maps every record in the array', () => {
    const results = parseBuscaEnListasResponse(fixture);
    expect(results).toHaveLength(fixture.length);
  });

  it('returns [] when input is not an array', () => {
    expect(parseBuscaEnListasResponse(null as any)).toEqual([]);
    expect(parseBuscaEnListasResponse(undefined as any)).toEqual([]);
    expect(parseBuscaEnListasResponse({} as any)).toEqual([]);
  });

  it('maps core fields from a record without photo', () => {
    const [first] = parseBuscaEnListasResponse(fixture);
    expect(first.provider).toBe('Busca en Listas VZLA');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Maria Prueba');
    // no img -> provider_id falls back to name|found
    expect(first.provider_id).toBe('Maria Prueba|2026-06-25 17:31:53');
    // empty note is dropped from subtitle
    expect(first.subtitle).toBe('Hospital Central');
    expect(first.status).toBe('listado');
    expect(first.location).toEqual([-66.9, 10.5]);
    expect(first.last_update).toBe('2026-06-25 17:31:53');
    expect(first.thumbnail).toBeUndefined();
    // no photo -> url falls back to the site home (the SPA has no deep-link)
    expect(first.url).toBe('https://buscaenlistasvzla.info/');
    expect(first.metadata).toMatchObject({ age: 47, sex: '', cedula: '', place: 'Hospital Central', match: 96 });
  });

  it('maps photo, cedula and joined subtitle from a full record', () => {
    const results = parseBuscaEnListasResponse(fixture);
    const withPhoto = results.find((r) => r.title === 'Jose Ejemplo');
    expect(withPhoto).toBeDefined();
    const img = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(withPhoto!.provider_id).toBe(img);
    expect(withPhoto!.thumbnail).toBe(`https://buscaenlistasvzla.info/image/${img}`);
    // with a photo -> url links to the source OCR list image
    expect(withPhoto!.url).toBe(`https://buscaenlistasvzla.info/image/${img}`);
    expect(withPhoto!.subtitle).toBe('Refugio Modelo · PISO 2');
    expect(withPhoto!.metadata).toMatchObject({ sex: 'M', cedula: '00000000' });
  });

  it('marks missing_match records as posible coincidencia', () => {
    const results = parseBuscaEnListasResponse([
      { name: 'X', found: '2026-01-01 00:00:00', missing_match: true },
    ]);
    expect(results[0].status).toBe('posible coincidencia');
    expect(results[0].location).toBeUndefined();
  });
});
