import { SignalEvaluator, RankingContext } from './types.js';
import { getObservations } from '../ranking/utils.js';

const CORROBORATION_PER_SOURCE = 40;
const CORROBORATION_MAX_SOURCES = 5;

export const corroborationSignal: SignalEvaluator = {
  name: 'CorroborationSignal',
  evaluate: (resource, context: RankingContext) => {
    const observations = getObservations(resource);
    if (observations.length > 1) {
      const extra = Math.min(observations.length - 1, CORROBORATION_MAX_SOURCES);
      const score = extra * CORROBORATION_PER_SOURCE;
      
      return {
        signal: 'CorroborationSignal',
        scoreContribution: score,
        explanation: `Supported by ${observations.length} providers`,
        debugMetadata: { totalSources: observations.length }
      };
    }
    return null;
  }
};
