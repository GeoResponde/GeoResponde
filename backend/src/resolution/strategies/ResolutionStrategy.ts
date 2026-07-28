import type { Observation, CandidateEntity } from '@georesponde/shared';

export interface ResolutionStrategy {
  /**
   * Groups a set of observations into Candidate Entities.
   * Can be chained or used as part of a multi-pass resolution pipeline.
   */
  execute(observations: Observation[]): CandidateEntity[];
}
