import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseTeBuscoResponse } from '../parser.js';

describe('Te Busco Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/desaparecidos.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parseTeBuscoResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps the first record correctly (missing)', () => {
    const [first] = parseTeBuscoResponse(fixture);
    expect(first.provider).toBe('Te Busco');
    expect(first.type).toBe('person');
    expect(first.title).toBe('Carlos Ejemplo');
    expect(first.status).toBe('missing');
    expect(first.url).toBe('https://tebusco.app/');
    expect(first.person?.fullName).toBe('Carlos Ejemplo');
    expect(first.person?.status).toBe('missing');
    expect(first.metadata?.phone).toBe('04141234567');
  });

  it('maps the second record correctly (safe)', () => {
    const [, second] = parseTeBuscoResponse(fixture);
    expect(second.status).toBe('safe');
    expect(second.person?.status).toBe('safe');
  });

  it('returns an empty array when input is not an array', () => {
    expect(parseTeBuscoResponse(undefined)).toEqual([]);
    expect(parseTeBuscoResponse(null)).toEqual([]);
    expect(parseTeBuscoResponse({} as any)).toEqual([]);
  });

  it('handles unknown status values', () => {
    const results = parseTeBuscoResponse([{ ...fixture[0], state: 'alien' }]);
    expect(results[0].status).toBe('unknown');
  });
});
