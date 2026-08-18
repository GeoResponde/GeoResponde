import type { Observation, CandidateEntity, ConfidenceLevel, RelatedObservation, RelationshipType, FieldConflict } from '@georesponde/shared';
import { RESOLUTION_THRESHOLDS } from '@georesponde/shared';
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

    // 3. Extract components and build candidate views using candidate threshold
    const components = graph.getConnectedComponents(RESOLUTION_THRESHOLDS.candidate);
    const candidates: CandidateEntity[] = [];
    const allEdges = graph.getEdges();

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
      } else {
        confidence = 'HIGH'; // Single observation has high internal consistency
      }

      // Collect related observations for this candidate
      const relatedObservations: RelatedObservation[] = [];
      const obsIds = new Set(comp.observations.map(o => o.id));

      for (const edge of allEdges) {
        // Find edges that connect an observation in this component to something else,
        // and are below the candidate merge threshold, but above the related threshold.
        if (edge.confidence >= RESOLUTION_THRESHOLDS.related && edge.confidence < RESOLUTION_THRESHOLDS.candidate) {
          const isSourceInComp = obsIds.has(edge.sourceId);
          const isTargetInComp = obsIds.has(edge.targetId);
          
          if (isSourceInComp !== isTargetInComp) {
            let relationshipType: RelationshipType = 'weak';
            if (edge.confidence >= 0.8) relationshipType = 'probable';
            else if (edge.confidence >= 0.6) relationshipType = 'possible';

            if (isSourceInComp) {
              relatedObservations.push({
                sourceObservationId: edge.sourceId,
                targetObservationId: edge.targetId,
                confidence: edge.confidence,
                relationshipType,
                reasons: edge.reasons
              });
            } else {
              relatedObservations.push({
                sourceObservationId: edge.targetId,
                targetObservationId: edge.sourceId,
                confidence: edge.confidence,
                relationshipType,
                reasons: edge.reasons
              });
            }
          }
        }
      }

      // Detect conflicts
      const conflicts = this.detectConflicts(comp.observations);

      candidates.push({
        id: crypto.randomUUID(),
        entityType: comp.observations[0]?.entityType || 'unknown',
        confidence,
        observations: comp.observations,
        conflicts,
        relatedObservations,
        explanations: Array.from(explanations),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return candidates;
  }

  private detectConflicts(observations: Observation[]): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    const fieldsToCheck = ['status', 'age', 'gender', 'hospital', 'lastSeenLocation'];

    for (const field of fieldsToCheck) {
      const valuesMap = new Map<string, Array<{ observationId: string; provider: string; value: unknown }>>();
      
      for (const obs of observations) {
        if (obs.entityType === 'person' && obs.normalizedFields.person) {
          const val = (obs.normalizedFields.person as any)[field];
          if (val !== undefined && val !== null && val !== '') {
            // Use lowercase/trim for string comparison to avoid false conflicts
            const key = typeof val === 'string' ? val.toLowerCase().trim() : String(val);
            if (!valuesMap.has(key)) {
              valuesMap.set(key, []);
            }
            valuesMap.get(key)!.push({
              observationId: obs.id,
              provider: obs.provider,
              value: val
            });
          }
        }
      }

      if (valuesMap.size > 1) {
        // We have a conflict (more than one distinct normalized value)
        const observationsList = [];
        for (const group of valuesMap.values()) {
          observationsList.push(...group);
        }
        conflicts.push({
          field,
          observations: observationsList
        });
      }
    }

    return conflicts;
  }
}
