import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAvisaveResponse } from '../parser.js';

describe('Avisave Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/incidents.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  const [first, second] = parseAvisaveResponse(fixture);

  it('parses the fixture array into normalized results', () => {
    const results = parseAvisaveResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps a redacted record correctly', () => {
    expect(first.provider).toBe('Avisave');
    expect(first.type).toBe('Shelters');
    expect(first.title).toBeTruthy();
    expect(first.subtitle).toBeTruthy();
    expect(first.status).toBeTruthy();
    expect(first.location).toBe(undefined)
    expect(first.last_update).toBeTruthy()
    expect(first.url).toStrictEqual("https://avisave.com/incidents/incident-fictional")
  });

  it('maps an unredacted record correctly', () => {
      expect(second.provider).toBe('Avisave');
      expect(second.type).toBe('Supplies');
      expect(second.title).toBeTruthy();
      expect(second.subtitle).toBeTruthy();
      expect(second.status).toBeTruthy();
      expect(second.location).toStrictEqual([-67, 39])
      expect(second.last_update).toBeTruthy()
      expect(second.url).toStrictEqual("https://avisave.com/incidents/other-incident-fictional")
  });


  it('returns an empty array when input is not an array', () => {
    expect(parseAvisaveResponse(undefined)).toEqual([]);
    expect(parseAvisaveResponse(null)).toEqual([]);
    expect(parseAvisaveResponse({} as any)).toEqual([]);
  });
});
