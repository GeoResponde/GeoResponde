import { describe, it, expect } from 'vitest';
import { NormalizedSearchResult } from '@georesponde/shared';
import { dedupePersons, personMergeKey } from '../dedupe.js';

function person(overrides: Partial<NormalizedSearchResult> & { provider: string }): NormalizedSearchResult {
  return {
    provider_id: Math.random().toString(),
    type: 'person',
    title: 'X',
    url: 'https://example.org',
    ...overrides,
  } as NormalizedSearchResult;
}

describe('dedupePersons', () => {
  it('merges two providers reporting the same cédula', () => {
    const results = [
      person({ provider: 'A', title: 'Maria Perez', person: { fullName: 'Maria Perez', cedula: '12345678' } }),
      person({ provider: 'B', title: 'MARIA PEREZ', person: { fullName: 'MARIA PEREZ', cedula: 'V-12.345.678', age: 30 } }),
    ];
    const out = dedupePersons(results);
    expect(out).toHaveLength(1);
    // representative is the more complete one (has age)
    expect(out[0].person?.age).toBe(30);
    expect(out[0].sources).toEqual([{ provider: 'A', url: 'https://example.org' }]);
    expect(out[0].metadata?.duplicate_count).toBe(2);
  });

  it('merges same normalized name + same age', () => {
    const results = [
      person({ provider: 'A', person: { fullName: 'José Gómez', age: 40 } }),
      person({ provider: 'B', person: { fullName: 'jose gomez', age: 40, hospital: 'Vargas' } }),
    ];
    const out = dedupePersons(results);
    expect(out).toHaveLength(1);
    expect(out[0].person?.hospital).toBe('Vargas');
  });

  it('does NOT merge same name with different ages', () => {
    const results = [
      person({ provider: 'A', person: { fullName: 'Ana Lopez', age: 20 } }),
      person({ provider: 'B', person: { fullName: 'Ana Lopez', age: 55 } }),
    ];
    expect(dedupePersons(results)).toHaveLength(2);
  });

  it('never merges on name alone (no age, no cédula)', () => {
    const results = [
      person({ provider: 'A', person: { fullName: 'Carlos Ruiz' } }),
      person({ provider: 'B', person: { fullName: 'Carlos Ruiz' } }),
    ];
    expect(personMergeKey(results[0])).toBeNull();
    expect(dedupePersons(results)).toHaveLength(2);
  });

  it('ignores masked (short) cédulas as a merge key', () => {
    const r = person({ provider: 'A', person: { fullName: 'Luis', cedula: '28••••11' } });
    expect(personMergeKey(r)).toBeNull();
  });

  it('passes non-person results through untouched and preserves order', () => {
    const results = [
      person({ provider: 'A', type: 'building', title: 'Edificio', person: undefined }),
      person({ provider: 'B', person: { fullName: 'Zoe Diaz', cedula: '99887766' } }),
      person({ provider: 'C', person: { fullName: 'Zoe Diaz', cedula: '99887766', age: 5 } }),
    ];
    const out = dedupePersons(results);
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('building');
    expect(out[1].metadata?.duplicate_count).toBe(2);
  });
});
