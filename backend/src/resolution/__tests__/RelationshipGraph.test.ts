import { describe, it, expect } from 'vitest';
import { RelationshipGraph } from '../RelationshipGraph.js';
import type { Observation, ObservationEdge } from '@georesponde/shared';

describe('RelationshipGraph', () => {
  const createObservation = (id: string): Observation => ({
    id,
    provider: 'test-provider',
    providerRecordId: `test-${id}`,
    entityType: 'person',
    identityHints: {},
    normalizedFields: { type: 'person', provider: 'test-provider' }
  });

  it('groups disconnected nodes into separate components', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('1'));
    graph.addNode(createObservation('2'));

    const components = graph.getConnectedComponents();
    expect(components).toHaveLength(2);
    expect(components.map(c => c.observations[0].id).sort()).toEqual(['1', '2']);
  });

  it('groups connected nodes into a single component and preserves edges', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('1'));
    graph.addNode(createObservation('2'));
    
    const edge: ObservationEdge = {
      sourceId: '1',
      targetId: '2',
      confidence: 0.9,
      reasons: ['test edge']
    };
    graph.addEdge(edge);

    const components = graph.getConnectedComponents();
    expect(components).toHaveLength(1);
    expect(components[0].observations).toHaveLength(2);
    expect(components[0].edges).toHaveLength(1);
    expect(components[0].edges[0]).toEqual(edge);
  });

  it('groups nodes transitively (A -> B -> C)', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    graph.addNode(createObservation('C'));
    graph.addNode(createObservation('D')); // Disconnected

    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 0.8, reasons: [] });
    graph.addEdge({ sourceId: 'B', targetId: 'C', confidence: 0.7, reasons: [] });

    const components = graph.getConnectedComponents();
    expect(components).toHaveLength(2);
    
    const largeComponent = components.find(c => c.observations.length === 3);
    const smallComponent = components.find(c => c.observations.length === 1);
    
    expect(largeComponent).toBeDefined();
    expect(smallComponent).toBeDefined();
    
    const largeIds = largeComponent!.observations.map(o => o.id).sort();
    expect(largeIds).toEqual(['A', 'B', 'C']);
    expect(largeComponent!.edges).toHaveLength(2);

    expect(smallComponent!.observations[0].id).toEqual('D');
  });

  it('ignores edges for unknown nodes safely', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('1'));

    // Edge refers to '2' which hasn't been added as a node
    graph.addEdge({ sourceId: '1', targetId: '2', confidence: 1.0, reasons: [] });

    const components = graph.getConnectedComponents();
    expect(components).toHaveLength(1);
    expect(components[0].observations).toHaveLength(1);
    expect(components[0].edges).toHaveLength(0); // Edge ignored
  });
});
