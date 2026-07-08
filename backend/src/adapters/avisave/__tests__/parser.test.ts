import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAvisave } from '../parser.js';

describe('Avisave Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/records.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parseAvisave(fixture);
    expect(results).toHaveLength(1);
  });

  it('maps the first record correctly', () => {
    const [first] = parseAvisave(fixture);
    expect(first.provider).toBe('Avisave');
    expect(first.type).toBe('Incident');
    expect(first.title).toBeTruthy();
  });

  it('returns an empty array when input is not an array', () => {
    expect(parseAvisave(undefined)).toEqual([]);
    expect(parseAvisave(null)).toEqual([]);
    expect(parseAvisave({} as any)).toEqual([]);
  });
});
