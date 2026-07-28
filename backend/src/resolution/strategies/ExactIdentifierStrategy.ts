import type { Observation, ObservationEdge } from '@georesponde/shared';
import { ResolutionStrategy } from './ResolutionStrategy.js';

/**
 * A generic strategy that creates edges between observations if they share an exact match
 * on any value within their identityHints (e.g. "national_id: V12345").
 */
export class ExactIdentifierStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];

    for (let i = 0; i < observations.length; i++) {
      const obsA = observations[i];
      for (let j = i + 1; j < observations.length; j++) {
        const obsB = observations[j];
        
        const intersectingKey = this.getIntersectingHint(obsA, obsB);
        if (intersectingKey) {
          edges.push({
            sourceId: obsA.id,
            targetId: obsB.id,
            confidence: 1.0,
            reasons: [`Exact match on ${intersectingKey}`]
          });
        }
      }
    }

    return edges;
  }

  private getIntersectingHint(a: Observation, b: Observation): string | null {
    if (!a.identityHints || !b.identityHints) return null;

    for (const [key, valuesA] of Object.entries(a.identityHints)) {
      const valuesB = b.identityHints[key];
      if (!valuesB) continue;

      for (const valA of valuesA) {
        if (valuesB.includes(valA)) {
          return key;
        }
      }
    }
    return null;
  }
}
