import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseReencuentraHtml } from '../parser.js';

describe('Reencuentra VE Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/buscar.html');
  const html = fs.readFileSync(fixturePath, 'utf-8');

  it('parses every persona card from the search HTML', () => {
    const results = parseReencuentraHtml(html);
    expect(results).toHaveLength(2);
  });

  it('maps id, title, status and url for each card', () => {
    const results = parseReencuentraHtml(html);

    const ana = results[0];
    expect(ana.provider).toBe('Reencuentra VE');
    expect(ana.provider_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(ana.type).toBe('person');
    expect(ana.title).toBe('Ana Prueba');
    expect(ana.status).toBe('Desaparecido');
    expect(ana.url).toBe('https://reencuentra-ve.vercel.app/persona/11111111-1111-4111-8111-111111111111');
    expect(ana.subtitle).toBe('27 años · Ciudad Ejemplo');
    expect(ana.metadata).toEqual({});

    const luis = results[1];
    expect(luis.provider_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(luis.title).toBe('Luis Ejemplo');
    expect(luis.status).toBe('Encontrado');
    expect(luis.url).toBe('https://reencuentra-ve.vercel.app/persona/22222222-2222-4222-8222-222222222222');
    expect(luis.subtitle).toBe('41 años · Villa Genérica');
  });

  it('returns an empty array when there are no cards', () => {
    expect(parseReencuentraHtml('<html><body><p>Sin resultados</p></body></html>')).toEqual([]);
  });
});
