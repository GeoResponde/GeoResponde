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
    normalizedFields: { type: 'person', provider: 'test-provider', title: id, url: '' }
  });

  const getComponentObservationIds = (graph: RelationshipGraph, minConfidence: number) => {
    return graph.getConnectedComponents(minConfidence).map(c => 
      c.observations.map(o => o.id).sort()
    );
  };

  it('groups disconnected nodes into separate components', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('1'));
    graph.addNode(createObservation('2'));

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(2);
    expect(components).toEqual(expect.arrayContaining([['1'], ['2']]));
  });

  it('Test A — High-confidence edge merges', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    
    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 1.0, reasons: [] });

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(1);
    expect(components[0]).toEqual(['A', 'B']);
    
    expect(graph.getEdges()).toHaveLength(1);
  });

  it('Test B — Low-confidence edge does not merge', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    
    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 0.4, reasons: [] });

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(2);
    expect(components).toEqual(expect.arrayContaining([['A'], ['B']]));
    
    // Edge must still exist in the graph
    expect(graph.getEdges()).toHaveLength(1);
  });

  it('Test C — High and low edges coexist', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    graph.addNode(createObservation('C'));

    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 0.95, reasons: [] });
    graph.addEdge({ sourceId: 'B', targetId: 'C', confidence: 0.40, reasons: [] });

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(2);
    expect(components).toEqual(expect.arrayContaining([['A', 'B'], ['C']]));

    // Graph must contain both relationships
    expect(graph.getEdges()).toHaveLength(2);
  });

  it('Test D — Transitive high-confidence grouping', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    graph.addNode(createObservation('C'));

    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 0.95, reasons: [] });
    graph.addEdge({ sourceId: 'B', targetId: 'C', confidence: 0.95, reasons: [] });

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(1);
    expect(components[0]).toEqual(['A', 'B', 'C']);
  });

  it('Test E — Transitive weak relationship does not bridge candidates', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('A'));
    graph.addNode(createObservation('B'));
    graph.addNode(createObservation('C'));
    graph.addNode(createObservation('D'));

    graph.addEdge({ sourceId: 'A', targetId: 'B', confidence: 0.95, reasons: [] });
    graph.addEdge({ sourceId: 'B', targetId: 'C', confidence: 0.50, reasons: [] });
    graph.addEdge({ sourceId: 'C', targetId: 'D', confidence: 0.95, reasons: [] });

    const components = getComponentObservationIds(graph, 0.9);
    expect(components).toHaveLength(2);
    expect(components).toEqual(expect.arrayContaining([['A', 'B'], ['C', 'D']]));

    // Weak edge preserved
    expect(graph.getEdges()).toHaveLength(3);
  });

  it('ignores edges for unknown nodes safely', () => {
    const graph = new RelationshipGraph();
    graph.addNode(createObservation('1'));

    graph.addEdge({ sourceId: '1', targetId: '2', confidence: 1.0, reasons: [] });

    const components = graph.getConnectedComponents(0.9);
    expect(components).toHaveLength(1);
    expect(components[0].observations).toHaveLength(1);
    expect(components[0].edges).toHaveLength(0); // Edge ignored because target node '2' doesn't exist
  });
});
