import { describe, it, expect } from 'vitest';
import { ResolutionEngine } from '../ResolutionEngine.js';
import { ResolutionStrategy } from '../strategies/ResolutionStrategy.js';
import type { Observation, ObservationEdge } from '@georesponde/shared';

// A mock strategy that connects observations if they have the same provider
class MockProviderStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];
    for (let i = 0; i < observations.length; i++) {
      for (let j = i + 1; j < observations.length; j++) {
        if (observations[i].provider === observations[j].provider) {
          edges.push({
            sourceId: observations[i].id,
            targetId: observations[j].id,
            confidence: 0.8,
            reasons: ['Same provider']
          });
        }
      }
    }
    return edges;
  }
}

// A mock strategy that connects observations if they have the same entityType
class MockTypeStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];
    for (let i = 0; i < observations.length; i++) {
      for (let j = i + 1; j < observations.length; j++) {
        if (observations[i].entityType === observations[j].entityType) {
          edges.push({
            sourceId: observations[i].id,
            targetId: observations[j].id,
            confidence: 0.6,
            reasons: ['Same entity type']
          });
        }
      }
    }
    return edges;
  }
}

describe('ResolutionEngine', () => {
  const createObservation = (id: string, provider: string, entityType: string): Observation => ({
    id,
    provider,
    providerRecordId: `test-${id}`,
    entityType,
    identityHints: {},
    normalizedFields: { type: entityType, provider } as any
  });

  const baseObservations = [
    createObservation('1', 'provider-A', 'person'),
    createObservation('2', 'provider-A', 'shelter'), // Connected to 1 by provider
    createObservation('3', 'provider-B', 'person'),  // Connected to 1 by type
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
    engine.register(new MockProviderStrategy());
    engine.register(new MockTypeStrategy());

    // Original order
    const clustersOrder1 = extractClusters(engine, [...baseObservations]);

    // Reverse order
    const clustersOrder2 = extractClusters(engine, [...baseObservations].reverse());

    // Shuffled order
    const clustersOrder3 = extractClusters(engine, [
      baseObservations[2],
      baseObservations[0],
      baseObservations[3],
      baseObservations[1]
    ]);

    expect(clustersOrder1).toEqual(clustersOrder2);
    expect(clustersOrder1).toEqual(clustersOrder3);

    // Specifically for this test case, 1, 2, and 3 should all be in the same cluster
    // because 1 connects to 2 (provider) and 1 connects to 3 (type).
    // Node 4 is alone.
    expect(clustersOrder1).toEqual(['1,2,3', '4']);
  });

  it('produces results independent of strategy registration order', () => {
    const engine1 = new ResolutionEngine();
    engine1.register(new MockProviderStrategy());
    engine1.register(new MockTypeStrategy());

    const engine2 = new ResolutionEngine();
    engine2.register(new MockTypeStrategy());
    engine2.register(new MockProviderStrategy());

    const clustersOrder1 = extractClusters(engine1, baseObservations);
    const clustersOrder2 = extractClusters(engine2, baseObservations);

    expect(clustersOrder1).toEqual(clustersOrder2);
    expect(clustersOrder1).toEqual(['1,2,3', '4']);
  });
});
