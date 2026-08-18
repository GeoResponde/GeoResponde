import type { Observation, ObservationEdge } from '@georesponde/shared';

export interface ConnectedComponent {
  observations: Observation[];
  edges: ObservationEdge[];
}

export class RelationshipGraph {
  private nodes: Map<string, Observation> = new Map();
  private edges: ObservationEdge[] = [];

  /**
   * Adds an observation node to the graph.
   */
  addNode(observation: Observation) {
    if (!this.nodes.has(observation.id)) {
      this.nodes.set(observation.id, observation);
    }
  }

  /**
   * Adds an edge (relationship) between two observations.
   */
  addEdge(edge: ObservationEdge) {
    this.edges.push(edge);
  }

  /**
   * Retrieves all registered observations.
   */
  getNodes(): Observation[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Retrieves all registered relationships (edges).
   */
  getEdges(): ObservationEdge[] {
    return this.edges;
  }

  /**
   * Finds all connected components (clusters of observations) in the graph.
   * Only edges with confidence >= minConfidence are traversed to build the clusters.
   * Observations that have no strong edges will form a component of size 1.
   */
  getConnectedComponents(minConfidence: number = 0): ConnectedComponent[] {
    const adjacencyList = new Map<string, Array<{ targetId: string; edge: ObservationEdge }>>();
    
    // Initialize adjacency list for all nodes
    for (const id of this.nodes.keys()) {
      adjacencyList.set(id, []);
    }

    // Populate adjacency list (undirected)
    for (const edge of this.edges) {
      if (!adjacencyList.has(edge.sourceId) || !adjacencyList.has(edge.targetId)) {
        continue; // Skip edges for unknown nodes
      }
      if (edge.confidence < minConfidence) {
        continue; // Skip weak edges when building clusters
      }
      adjacencyList.get(edge.sourceId)!.push({ targetId: edge.targetId, edge });
      adjacencyList.get(edge.targetId)!.push({ targetId: edge.sourceId, edge });
    }

    const visited = new Set<string>();
    const components: ConnectedComponent[] = [];

    for (const [nodeId, observation] of this.nodes.entries()) {
      if (visited.has(nodeId)) continue;

      const componentNodes: Observation[] = [];
      const componentEdges = new Set<ObservationEdge>();
      const queue: string[] = [nodeId];
      visited.add(nodeId);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        componentNodes.push(this.nodes.get(currentId)!);

        const neighbors = adjacencyList.get(currentId) || [];
        for (const neighbor of neighbors) {
          componentEdges.add(neighbor.edge);
          if (!visited.has(neighbor.targetId)) {
            visited.add(neighbor.targetId);
            queue.push(neighbor.targetId);
          }
        }
      }

      components.push({
        observations: componentNodes,
        edges: Array.from(componentEdges),
      });
    }

    return components;
  }
}
