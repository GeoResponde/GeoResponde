import type { Observation, CandidateEntity } from '@georesponde/shared';
import { ResolutionStrategy } from './ResolutionStrategy.js';
import crypto from 'crypto';

/**
 * A generic strategy that groups observations if they share an exact match
 * on any value within their identityHints (e.g. "national_id: V12345").
 */
export class ExactIdentifierStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): CandidateEntity[] {
    const candidates: CandidateEntity[] = [];
    const grouped = new Set<string>();

    for (let i = 0; i < observations.length; i++) {
      const obsA = observations[i];
      if (grouped.has(obsA.id)) continue;

      const cluster = [obsA];
      grouped.add(obsA.id);

      // Check remaining observations for any intersecting hint
      for (let j = i + 1; j < observations.length; j++) {
        const obsB = observations[j];
        if (grouped.has(obsB.id)) continue;
        
        if (this.hasIntersectingHints(obsA, obsB)) {
          cluster.push(obsB);
          grouped.add(obsB.id);
        }
      }

      candidates.push(this.createCandidate(cluster));
    }

    return candidates;
  }

  private hasIntersectingHints(a: Observation, b: Observation): boolean {
    if (!a.identityHints || !b.identityHints) return false;

    for (const [key, valuesA] of Object.entries(a.identityHints)) {
      const valuesB = b.identityHints[key];
      if (!valuesB) continue;

      for (const valA of valuesA) {
        if (valuesB.includes(valA)) {
          return true;
        }
      }
    }
    return false;
  }

  private createCandidate(observations: Observation[]): CandidateEntity {
    return {
      id: crypto.randomUUID(),
      entityType: observations[0]?.entityType || 'unknown',
      confidence: observations.length > 1 ? 'HIGH' : 'NORMAL',
      observations,
      conflicts: [], // Core conflict detection is delegated
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
