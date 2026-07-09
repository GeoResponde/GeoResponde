import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAvisaveResponse } from '../parser.js';

describe('Avisave Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/incidents.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parseAvisaveResponse(fixture);
    expect(results).toHaveLength(1);
  });

  it('maps the first record correctly', () => {
    const [first] = parseAvisaveResponse(fixture);
    expect(first.provider).toBe('Avisave');
    expect(first.type).toBe('Incident');
    expect(first.title).toBeTruthy();
  });

  it('returns an empty array when input is not an array', () => {
    expect(parseAvisaveResponse(undefined)).toEqual([]);
    expect(parseAvisaveResponse(null)).toEqual([]);
    expect(parseAvisaveResponse({} as any)).toEqual([]);
  });
});
