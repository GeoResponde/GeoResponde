import { describe, it, expect } from 'vitest';
import { HeuristicMatchStrategy } from '../HeuristicMatchStrategy.js';
import type { Observation } from '@georesponde/shared';

function makeObservation(id: string, personData: any): Observation {
  return {
    id,
    provider: 'test-provider',
    providerRecordId: id,
    entityType: 'person',
    identityHints: {},
    normalizedFields: {
      provider: 'test-provider',
      provider_id: id,
      type: 'person',
      title: 'Test',
      url: 'http://test',
      person: personData
    }
  };
}

describe('HeuristicMatchStrategy', () => {
  const strategy = new HeuristicMatchStrategy();

  it('1. Common Name: Maria Perez in different locations is rejected / stays below threshold', () => {
    const obsA = makeObservation('1', { fullName: 'Maria Perez', lastSeenLocation: 'Caracas' });
    const obsB = makeObservation('2', { fullName: 'Maria Perez', lastSeenLocation: 'Maracaibo' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(1);
    
    // Expect score to be exactly 0.8 (name match) - 0.1 (location penalty) = 0.7.
    // This is below candidate threshold (0.9), creating a MEDIUM/Related Observation.
    expect(edges[0].confidence).toBeLessThan(0.9);
    expect(edges[0].reasons).toContain('Differing locations');
  });

  it('2. Missing Identifiers & Variation: Sugeyli Estrella vs Sugeylis Estrella with compatible context reaches >= 0.9', () => {
    const obsA = makeObservation('1', { fullName: 'Sugeyli Estrella Monterrey Alvarez', age: 40, gender: 'female', lastSeenLocation: 'Caracas' });
    const obsB = makeObservation('2', { fullName: 'Sugeilis Estrella Monterrey Alvarez', age: 40, gender: 'female', lastSeenLocation: 'Caracas' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(1);
    
    // Should cross the 0.9 threshold because of name similarity + age + gender + location
    expect(edges[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(edges[0].reasons).toContain('Compatible age');
    expect(edges[0].reasons).toContain('Compatible location');
    expect(edges[0].reasons).toContain('Matching gender');
  });

  it('3. Masked ID: V-12****28 vs V-12879928 with identical name reaches >= 0.9', () => {
    const obsA = makeObservation('1', { fullName: 'Sugeyli Estrella', cedula: 'V-12****28' });
    const obsB = makeObservation('2', { fullName: 'Sugeyli Estrella', cedula: 'V-12879928' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(1);
    expect(edges[0].reasons).toContain('Compatible masked identifier');
    
    // Base 0.8 + 0.15 masked boost = 0.95 >= 0.9
    expect(edges[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('3b. Masked ID alone without name match is 0.0', () => {
    // If names are entirely different, it drops out early.
    const obsA = makeObservation('1', { fullName: 'Juan Perez', cedula: 'V-12****28' });
    const obsB = makeObservation('2', { fullName: 'Carlos Gomez', cedula: 'V-12879928' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(0); // Name similarity < 0.4
  });

  it('4. Conflicting IDs: Maria Perez 12345678 vs Maria Perez 87654321 is rejected', () => {
    const obsA = makeObservation('1', { fullName: 'Maria Perez', cedula: '12345678' });
    const obsB = makeObservation('2', { fullName: 'Maria Perez', cedula: '87654321' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(0); // 0.0 confidence veto
  });

  it('5. Exact Name Only: Maria Perez vs Maria Perez is below candidate threshold', () => {
    const obsA = makeObservation('1', { fullName: 'Maria Perez' });
    const obsB = makeObservation('2', { fullName: 'Maria Perez' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(1);
    
    // Base name similarity is 0.8, no context, so remains 0.8 (which is >= 0.5 but < 0.9)
    expect(edges[0].confidence).toBe(0.8);
    expect(edges[0].confidence).toBeLessThan(0.9);
  });

  it('6. Masked IDs with incompatible prefixes vetoes the match', () => {
    const obsA = makeObservation('1', { fullName: 'Maria Perez', cedula: 'V-12****28' });
    const obsB = makeObservation('2', { fullName: 'Maria Perez', cedula: 'V-13999928' });
    
    const edges = strategy.execute([obsA, obsB]);
    expect(edges).toHaveLength(0);
  });

  it('7. Incompatible demographics vetoes the match', () => {
    const obsA = makeObservation('1', { fullName: 'Maria Perez', gender: 'female', age: 30 });
    const obsB = makeObservation('2', { fullName: 'Maria Perez', gender: 'male', age: 30 });
    
    const edges1 = strategy.execute([obsA, obsB]);
    expect(edges1).toHaveLength(0); // Gender mismatch

    const obsC = makeObservation('3', { fullName: 'Maria Perez', age: 20 });
    const obsD = makeObservation('4', { fullName: 'Maria Perez', age: 40 });

    const edges2 = strategy.execute([obsC, obsD]);
    expect(edges2).toHaveLength(0); // Age difference > 5
  });
});
