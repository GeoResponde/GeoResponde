import type { Observation, ObservationEdge } from '@georesponde/shared';

export interface ResolutionStrategy {
  /**
   * Evaluates a set of observations and returns the calculated edges (relationships)
   * between them. The edges will be combined into a RelationshipGraph.
   */
  execute(observations: Observation[]): ObservationEdge[];
}
