import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseUbicameShard, UbicameRecord } from '../parser.js';

describe('Úbícame parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/shard-a.json');
  const records = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as UbicameRecord[];

  it('filters and normalizes matching records from a letter shard', () => {
    const results = parseUbicameShard(records, 'ana');

    expect(results.length).toBe(1);

    const ana = results[0];
    expect(ana.provider).toBe('Úbícame');
    expect(ana.provider_id).toBe('LP-1');
    expect(ana.type).toBe('person');
    expect(ana.title).toBe('Ana Prueba');
    expect(ana.subtitle).toContain('Hospital de Ejemplo');
    expect(ana.subtitle).toContain(' · ');
    expect(ana.status).toBe('believed_alive');
    expect(ana.last_update).toBe('2026-06-30T01:06:04Z');
    expect(ana.url).toBe('https://911.ubica.me/');
    expect(ana.metadata).toMatchObject({
      age: '57',
      cedula: '00000001',
      source: 'SYNTHETIC_TEST_FIXTURE',
    });
  });

  it('returns an empty array when nothing matches the query', () => {
    expect(parseUbicameShard(records, 'zzzznomatch')).toEqual([]);
  });

  it('is defensive against a non-array payload', () => {
    expect(parseUbicameShard(undefined as unknown as UbicameRecord[], 'a')).toEqual([]);
  });
});
