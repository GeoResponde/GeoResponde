import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseCollectionCenters } from '../parser.js';

describe('AcopioVenezuelaAyudaParser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/search-response.json');
  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('should parse the full fixture array', () => {
    const results = parseCollectionCenters('test-provider', rawData);
    expect(results).toHaveLength(3);

    const [first, second, third] = results;

    expect(first.title).toBe('Fundación Ficticia');
    expect(first.subtitle).toBe('Agua, alimentos no perecederos, ropa en buen estado');
    expect(first.metadata?.address).toBe('Avenida Siempre Viva 123, Caracas, Venezuela');
    expect(first.metadata?.photo).toBe('si');
    expect(first.metadata?.reported).toBe(false);

    expect(second.metadata?.photo).toBeUndefined(); // 'no' should be filtered out
    expect(second.metadata?.reported).toBe(true); // '1' is true

    expect(third.metadata?.address).toBe('Campus Universitario'); // Empty city/country omitted
    expect(third.metadata?.photo).toBeUndefined();
    expect(third.metadata?.reported).toBeUndefined();
  });

  it('should omit records without a name (Quién)', () => {
    const results = parseCollectionCenters('test-provider', [
      { 'Qué reciben': 'Todo' },
      { 'Quién': '   ', 'Qué reciben': 'Nada' }
    ]);
    expect(results).toHaveLength(0);
  });
  
  it('should handle missing array', () => {
    const results = parseCollectionCenters('test-provider', null as any);
    expect(results).toHaveLength(0);
  });
});
