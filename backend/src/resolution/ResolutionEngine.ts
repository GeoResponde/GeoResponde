import type { Observation, CandidateEntity } from '@georesponde/shared';
import { ResolutionStrategy } from './strategies/ResolutionStrategy.js';

export class ResolutionEngine {
  private strategies: ResolutionStrategy[] = [];

  use(strategy: ResolutionStrategy) {
    this.strategies.push(strategy);
  }

  /**
   * Runs observations through the resolution pipeline.
   * For V1, we rely on the first registered strategy (or fallback to 1:1 candidate creation).
   */
  resolve(observations: Observation[]): CandidateEntity[] {
    if (this.strategies.length === 0) {
      // Fallback: 1 observation = 1 candidate
      return observations.map(obs => ({
        id: `ce-${obs.id}`,
        entityType: obs.entityType,
        confidence: 'NORMAL',
        observations: [obs],
        conflicts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }

    // Execute the primary grouping strategy
    const candidates = this.strategies[0].execute(observations);

    // Conflict detection logic would go here.
    // In V1, generic visual conflict detection is handled at the UI layer.

    return candidates;
  }
}
