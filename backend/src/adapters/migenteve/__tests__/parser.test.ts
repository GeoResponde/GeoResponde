import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseMiGenteVeResponse, normalizeReport } from '../parser.js';

describe('MiGenteVE Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/reports.json');
  const response = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('normalizes every report in the API response', () => {
    const results = parseMiGenteVeResponse(response);
    expect(results).toHaveLength(2);
  });

  it('maps a pet report with valid coordinates', () => {
    const [first] = parseMiGenteVeResponse(response);
    expect(first.provider).toBe('Patitas a Salvo VE');
    expect(first.provider_id).toBe('a1b2c3');
    expect(first.type).toBe('pet');
    expect(first.title).toBe('Nube');
    expect(first.subtitle).toBe('Perro · Mestizo · Chacao · Caracas');
    expect(first.status).toBe('perdido');
    expect(first.url).toBe('https://migenteve.com/reporte/a1b2c3');
    // Valid coords sanitized to [lng, lat].
    expect(first.location).toEqual([-66.8517, 10.4998]);
    expect(first.last_update).toBe(new Date(1719792000000).toISOString());
    // Relative photo path is absolutized.
    expect(first.thumbnail).toBe('https://migenteve.com/uploads/nube.jpg');
    expect(first.metadata).toMatchObject({ species: 'Perro', breed: 'Mestizo', color: 'Blanco y marrón' });
    // Pet records never carry a person block or contact data.
    expect((first as Record<string, unknown>).person).toBeUndefined();
  });

  it('drops broken coordinates during sanitization', () => {
    const [, second] = parseMiGenteVeResponse(response);
    expect(second.provider_id).toBe('d4e5f6');
    expect(second.type).toBe('pet');
    expect(second.url).toBe('https://migenteve.com/reporte/d4e5f6');
    // lat=999 (out of range) and lng=null -> undefined.
    expect(second.location).toBeUndefined();
    // Absolute photo url is passed through untouched.
    expect(second.thumbnail).toBe('https://cdn.example.org/pelusa.png');
  });

  it('falls back to a placeholder title when the pet name is missing', () => {
    const result = normalizeReport({ id: 'x', lat: null, lng: null });
    expect(result.title).toBe('Sin nombre');
    expect(result.url).toBe('https://migenteve.com/reporte/x');
    expect(result.location).toBeUndefined();
    expect(result.last_update).toBeUndefined();
    expect(result.thumbnail).toBeUndefined();
    expect(result.subtitle).toBeUndefined();
  });

  it('returns an empty array for malformed responses', () => {
    expect(parseMiGenteVeResponse({} as never)).toEqual([]);
    expect(parseMiGenteVeResponse({ reports: undefined })).toEqual([]);
  });
});
