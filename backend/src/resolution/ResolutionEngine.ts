import type { Observation, CandidateEntity, ConfidenceLevel } from '@georesponde/shared';
import { ResolutionStrategy } from './strategies/ResolutionStrategy.js';
import { RelationshipGraph } from './RelationshipGraph.js';
import crypto from 'crypto';

export class ResolutionEngine {
  private strategies: ResolutionStrategy[] = [];

  register(strategy: ResolutionStrategy) {
    this.strategies.push(strategy);
  }

  /**
   * Runs observations through the resolution pipeline.
   * V2 creates a RelationshipGraph and derives Candidates from connected components.
   */
  resolve(observations: Observation[]): CandidateEntity[] {
    const graph = new RelationshipGraph();
    
    // 1. Add all nodes
    for (const obs of observations) {
      graph.addNode(obs);
    }

    // 2. Execute all strategies and collect edges
    for (const strategy of this.strategies) {
      const edges = strategy.execute(observations);
      for (const edge of edges) {
        graph.addEdge(edge);
      }
    }

    // 3. Extract components and build candidate views
    const components = graph.getConnectedComponents();
    const candidates: CandidateEntity[] = [];

    for (const comp of components) {
      let confidence: ConfidenceLevel = 'LOW';
      const explanations = new Set<string>();

      // Derive confidence from edges
      if (comp.observations.length > 1) {
        let maxConfidence = 0;
        for (const edge of comp.edges) {
          if (edge.confidence > maxConfidence) {
            maxConfidence = edge.confidence;
          }
          for (const reason of edge.reasons) {
            explanations.add(reason);
          }
        }
        
        if (maxConfidence >= 0.9) confidence = 'HIGH';
        else if (maxConfidence >= 0.5) confidence = 'MEDIUM';
        else confidence = 'LOW';
      }

      candidates.push({
        id: crypto.randomUUID(),
        entityType: comp.observations[0]?.entityType || 'unknown',
        confidence,
        observations: comp.observations,
        conflicts: [], // Conflict detection delegated elsewhere
        explanations: Array.from(explanations),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return candidates;
  }
}
