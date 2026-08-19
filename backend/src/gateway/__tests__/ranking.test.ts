import { describe, it, expect } from 'vitest';
import { CandidateEntity, NormalizedSearchResult } from '@georesponde/shared';
import { rankResults, scoreResult } from '../ranking.js';

let nextId = 1;
function makeCandidate(over: Partial<NormalizedSearchResult> = {}, extraObs: Partial<NormalizedSearchResult>[] = []): CandidateEntity {
  const observations = [{
    id: String(nextId++),
    provider: over.provider || 'Test Provider',
    providerRecordId: over.provider_id || 'prov-test',
    entityType: over.type || 'person',
    identityHints: {},
    normalizedFields: {
      provider: 'Test Provider',
      provider_id: 'prov-test',
      type: 'person',
      title: 'Unknown',
      url: 'https://example.com/r',
      ...over,
    },
    observedAt: over.last_update,
    updatedAt: over.last_update,
  }];

  for (const eo of extraObs) {
    observations.push({
      id: String(nextId++),
      provider: eo.provider || 'Test Provider',
      providerRecordId: eo.provider_id || 'prov-test',
      entityType: eo.type || 'person',
      identityHints: {},
      normalizedFields: {
        provider: 'Test Provider',
        provider_id: 'prov-test',
        type: 'person',
        title: 'Unknown',
        url: 'https://example.com/r',
        ...eo,
      }
    });
  }

  return {
    id: String(nextId++),
    entityType: over.type || 'person',
    confidence: 'NORMAL',
    observations: observations as any,
    conflicts: [],
    createdAt: new Date().toISOString(),
    updatedAt: over.last_update || new Date().toISOString()
  };
}

const order = (results: CandidateEntity[]) => results.map((r) => r.observations[0].normalizedFields.title);

describe('rankResults', () => {
  it('returns an empty array for empty input', () => {
    expect(rankResults([], 'maria perez')).toEqual([]);
  });

  it('ranks an exact title match above a partial one', () => {
    const exact = makeCandidate({ title: 'Maria Perez' });
    const partial = makeCandidate({ title: 'Maria Gonzalez' });
    expect(order(rankResults([partial, exact], 'Maria Perez'))).toEqual([
      'Maria Perez',
      'Maria Gonzalez',
    ]);
  });

  it('is accent and case insensitive on the query match', () => {
    const a = makeCandidate({ title: 'MARÍA PÉREZ' });
    const b = makeCandidate({ title: 'Jose Ramirez' });
    expect(order(rankResults([b, a], 'maria perez'))).toEqual(['MARÍA PÉREZ', 'Jose Ramirez']);
  });

  it('ranks all-token matches above single-token matches', () => {
    const all = makeCandidate({ title: 'Ana Maria Suarez' }); // both tokens
    const one = makeCandidate({ title: 'Ana Gomez' }); // one token
    expect(order(rankResults([one, all], 'ana maria'))).toEqual([
      'Ana Maria Suarez',
      'Ana Gomez',
    ]);
  });

  it('breaks equal query matches by corroboration (more sources wins)', () => {
    const solo = makeCandidate({ title: 'Maria Perez', provider_id: 'a' });
    const corroborated = makeCandidate({
      title: 'Maria Perez',
      provider_id: 'b'
    }, [
      { title: 'Maria Perez' },
      { title: 'Maria Perez' }
    ]);
    expect(order(rankResults([solo, corroborated], 'Maria Perez'))[0]).toBe('Maria Perez');
    // The corroborated one must come first; disambiguate by provider_id.
    const ranked = rankResults([solo, corroborated], 'Maria Perez');
    expect(ranked[0].observations[0].normalizedFields.provider_id).toBe('b');
  });

  it('a full query match outranks corroboration (priority order)', () => {
    const matchOnly = makeCandidate({ title: 'Maria Perez', provider_id: 'match' });
    const corroboratedNoMatch = makeCandidate({
      title: 'Someone Else',
      provider_id: 'corr'
    }, Array.from({ length: 5 }, (_, i) => ({ title: 'Someone Else' })));
    const ranked = rankResults([corroboratedNoMatch, matchOnly], 'Maria Perez');
    expect(ranked[0].observations[0].normalizedFields.provider_id).toBe('match');
  });

  it('gives structured data (cedula/age/coords) a bonus over a bare record', () => {
    const bare = makeCandidate({ title: 'Maria Perez', provider_id: 'bare' });
    const structured = makeCandidate({
      title: 'Maria Perez',
      provider_id: 'struct',
      person: { fullName: 'Maria Perez', cedula: '12345678', age: 30 },
      location: [-66.9, 10.5],
    });
    expect(rankResults([bare, structured], 'Maria Perez')[0].observations[0].normalizedFields.provider_id).toBe('struct');
  });

  it('uses provider confidence as a lower-priority signal', () => {
    const low = makeCandidate({ title: 'Maria Perez', provider_id: 'low', confidence: 0.1 });
    const high = makeCandidate({ title: 'Maria Perez', provider_id: 'high', confidence: 0.9 });
    expect(rankResults([low, high], 'Maria Perez')[0].observations[0].normalizedFields.provider_id).toBe('high');
  });

  it('breaks a full tie by recency (newer last_update first)', () => {
    const older = makeCandidate({
      title: 'Maria Perez',
      provider_id: 'old',
      last_update: '2026-01-01T00:00:00Z',
    });
    const newer = makeCandidate({
      title: 'Maria Perez',
      provider_id: 'new',
      last_update: '2026-07-01T00:00:00Z',
    });
    expect(rankResults([older, newer], 'Maria Perez')[0].observations[0].normalizedFields.provider_id).toBe('new');
  });

  it('is a stable sort when everything ties', () => {
    const a = makeCandidate({ title: 'Same', provider_id: 'a', last_update: '2026-01-01T00:00:00Z' });
    const b = makeCandidate({ title: 'Same', provider_id: 'b', last_update: '2026-01-01T00:00:00Z' });
    const c = makeCandidate({ title: 'Same', provider_id: 'c', last_update: '2026-01-01T00:00:00Z' });
    expect(rankResults([a, b, c], 'nomatch').map((r) => r.observations[0].normalizedFields.provider_id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [
      makeCandidate({ title: 'Maria Gonzalez' }),
      makeCandidate({ title: 'Maria Perez' }),
    ];
    const snapshot = order(input);
    rankResults(input, 'Maria Perez');
    expect(order(input)).toEqual(snapshot);
  });

  it('scoreResult is zero when the query does not match and no other signals exist', () => {
    const r = makeCandidate({ title: 'Totally Different' });
    expect(scoreResult(r, ['maria', 'perez'], 'maria perez')).toBe(0);
  });
});

