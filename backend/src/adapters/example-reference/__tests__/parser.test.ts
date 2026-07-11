import { describe, it, expect } from 'vitest';
import { parseUsersResponse, normalizeUser } from '../parser.js';
import { loadFixture, expectNormalizedResult } from '../../testing/index.js';
import { JsonPlaceholderUser } from '../parser.js';

describe('Example Reference Parser', () => {
  const fixture = loadFixture<JsonPlaceholderUser[]>('example-reference', 'users.json');

  it('normalizes every user in the fixture', () => {
    const results = parseUsersResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps core fields into the normalized shape', () => {
    const [first] = parseUsersResponse(fixture);
    expect(first.provider).toBe('Example Reference Provider');
    expect(first.provider_id).toBe('1');
    expect(first.type).toBe('reference');
    expect(first.title).toBe('Ana Prueba');
    expect(first.url).toBe('https://jsonplaceholder.typicode.com/users/1');
    expect(first.subtitle).toContain('Ciudad Ficticia');
    expect(first.metadata?.username).toBe('ana.prueba');
  });

  it('produces results that conform to NormalizedSearchResult', () => {
    for (const result of parseUsersResponse(fixture)) {
      expectNormalizedResult(result);
    }
  });

  it('falls back to the username when the name is missing', () => {
    const result = normalizeUser({ id: 99, username: 'sin-nombre' });
    expect(result.title).toBe('sin-nombre');
  });

  it('returns an empty array for malformed responses', () => {
    expect(parseUsersResponse(undefined)).toEqual([]);
    expect(parseUsersResponse(null)).toEqual([]);
    expect(parseUsersResponse({} as never)).toEqual([]);
  });
});
