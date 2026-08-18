import { describe, it, expect } from 'vitest';
import { ResolutionEngine } from '../ResolutionEngine.js';
import { ResolutionStrategy } from '../strategies/ResolutionStrategy.js';
import type { Observation, ObservationEdge } from '@georesponde/shared';

// A mock strategy that connects observations if they have the same provider (weak connection, 0.6)
class MockProviderStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];
    for (let i = 0; i < observations.length; i++) {
      for (let j = i + 1; j < observations.length; j++) {
        if (observations[i].provider === observations[j].provider) {
          edges.push({
            sourceId: observations[i].id,
            targetId: observations[j].id,
            confidence: 0.6,
            reasons: ['Same provider']
          });
        }
      }
    }
    return edges;
  }
}

// A mock strategy that simulates deterministic match (1.0)
class MockDeterministicStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];
    for (let i = 0; i < observations.length; i++) {
      for (let j = i + 1; j < observations.length; j++) {
        const ids = [observations[i].id, observations[j].id].sort();
        if (ids[0] === '1' && ids[1] === '2') {
          edges.push({
            sourceId: observations[i].id,
            targetId: observations[j].id,
            confidence: 1.0,
            reasons: ['Exact match']
          });
        }
      }
    }
    return edges;
  }
}

describe('ResolutionEngine', () => {
  const createObservation = (id: string, provider: string, entityType: string, personData?: any): Observation => ({
    id,
    provider,
    providerRecordId: `test-${id}`,
    entityType,
    identityHints: {},
    normalizedFields: { 
      type: entityType, 
      provider, 
      title: id, 
      url: '',
      person: personData
    } as any
  });

  const baseObservations = [
    createObservation('1', 'provider-A', 'person'),
    createObservation('2', 'provider-B', 'person'), // Connected to 1 deterministically (1.0)
    createObservation('3', 'provider-B', 'person'), // Connected to 2 by provider (0.6 - weak)
    createObservation('4', 'provider-C', 'vehicle'), // Disconnected
  ];

  const extractClusters = (engine: ResolutionEngine, obs: Observation[]) => {
    const candidates = engine.resolve(obs);
    return candidates
      .map(c => c.observations.map(o => o.id).sort().join(','))
      .sort();
  };

  it('produces results independent of observation order', () => {
    const engine = new ResolutionEngine();
    engine.register(new MockDeterministicStrategy());
    engine.register(new MockProviderStrategy());

    // Original order
    const clustersOrder1 = extractClusters(engine, [...baseObservations]);
    // Reverse order
    const clustersOrder2 = extractClusters(engine, [...baseObservations].reverse());

    expect(clustersOrder1).toEqual(clustersOrder2);
    // Nodes 1 and 2 merge (1.0). Node 3 is weak (0.6) so it stands alone. Node 4 stands alone.
    expect(clustersOrder1).toEqual(['1,2', '3', '4']);
  });

  it('produces results independent of strategy registration order', () => {
    const engine1 = new ResolutionEngine();
    engine1.register(new MockProviderStrategy());
    engine1.register(new MockDeterministicStrategy());

    const engine2 = new ResolutionEngine();
    engine2.register(new MockDeterministicStrategy());
    engine2.register(new MockProviderStrategy());

    const clustersOrder1 = extractClusters(engine1, baseObservations);
    const clustersOrder2 = extractClusters(engine2, baseObservations);

    expect(clustersOrder1).toEqual(clustersOrder2);
    expect(clustersOrder1).toEqual(['1,2', '3', '4']);
  });

  it('preserves weak relationships as relatedObservations without merging', () => {
    const engine = new ResolutionEngine();
    engine.register(new MockDeterministicStrategy());
    engine.register(new MockProviderStrategy());

    const candidates = engine.resolve(baseObservations);

    const mergedCandidate = candidates.find(c => c.observations.map(o => o.id).includes('1'))!;
    expect(mergedCandidate.observations).toHaveLength(2);

    const weakCandidate = candidates.find(c => c.observations.map(o => o.id).includes('3'))!;
    expect(weakCandidate.observations).toHaveLength(1);

    // Merged candidate (1,2) should have a related observation to 3, because 2 is connected to 3 by provider.
    expect(mergedCandidate.relatedObservations).toBeDefined();
    expect(mergedCandidate.relatedObservations!.length).toBeGreaterThan(0);
    const relation = mergedCandidate.relatedObservations!.find(r => r.targetObservationId === '3' || r.sourceObservationId === '3');
    expect(relation).toBeDefined();
    expect(relation!.confidence).toBe(0.6);
  });

  it('detects provider conflicts', () => {
    const engine = new ResolutionEngine();
    engine.register(new MockDeterministicStrategy());

    const obsWithConflicts = [
      createObservation('1', 'provider-A', 'person', { status: 'found' }),
      createObservation('2', 'provider-B', 'person', { status: 'missing' }),
    ];

    const candidates = engine.resolve(obsWithConflicts);
    expect(candidates).toHaveLength(1); // Merged by MockDeterministicStrategy

    const candidate = candidates[0];
    expect(candidate.conflicts).toHaveLength(1);
    expect(candidate.conflicts[0].field).toBe('status');
    expect(candidate.conflicts[0].observations).toHaveLength(2);
    expect(candidate.conflicts[0].observations.map(o => o.value).sort()).toEqual(['found', 'missing']);
  });
});
