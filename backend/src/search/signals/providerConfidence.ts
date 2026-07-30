import { SignalEvaluator, RankingContext } from './types.js';
import { getObservations } from '../ranking/utils.js';

const CONFIDENCE_WEIGHT = 20;

export const providerConfidenceSignal: SignalEvaluator = {
  name: 'ProviderConfidenceSignal',
  evaluate: (resource, context: RankingContext) => {
    const observations = getObservations(resource);
    if (observations.length === 0) return null;

    let maxConfidence = 0;

    for (const obs of observations) {
      const c = typeof obs.confidence === 'number' ? obs.confidence : 0;
      const normalizedC = Math.max(0, Math.min(1, c));
      if (normalizedC > maxConfidence) {
        maxConfidence = normalizedC;
      }
    }

    if (maxConfidence > 0) {
      return {
        signal: 'ProviderConfidenceSignal',
        scoreContribution: maxConfidence * CONFIDENCE_WEIGHT,
        explanation: 'High provider confidence',
        debugMetadata: { maxConfidence }
      };
    }

    return null;
  }
};
