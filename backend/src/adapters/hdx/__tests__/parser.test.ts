import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseHdxResponse, normalizeDataset } from '../parser.js';

describe('HDX Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/package_search.json');
  const response = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('normalizes every dataset in the API response', () => {
    const results = parseHdxResponse(response);
    expect(results).toHaveLength(2);
  });

  it('maps core fields into the normalized shape', () => {
    const [first] = parseHdxResponse(response);
    expect(first.provider).toBe('Humanitarian Data Exchange');
    expect(first.provider_id).toBe('venezuela-earthquake-hazardous-facilities');
    expect(first.type).toBe('dataset');
    expect(first.title).toBe('Venezuela - Earthquake Hazardous Facilities');
    expect(first.url).toBe(
      'https://data.humdata.org/dataset/venezuela-earthquake-hazardous-facilities',
    );
    expect(first.last_update).toBe('2026-06-26T14:30:00.700345');
    expect(first.subtitle).toContain('Venezuela');
    expect(first.subtitle).toContain('UNEP/OCHA');
  });

  it('falls back to the dataset slug when the title is missing', () => {
    const result = normalizeDataset({ name: 'untitled-dataset' });
    expect(result.title).toBe('untitled-dataset');
    expect(result.url).toBe('https://data.humdata.org/dataset/untitled-dataset');
  });

  it('returns an empty array for malformed responses', () => {
    expect(parseHdxResponse({} as never)).toEqual([]);
    expect(parseHdxResponse({ result: { results: undefined } })).toEqual([]);
  });
});
