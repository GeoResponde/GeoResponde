import { SignalEvaluator, RankingContext } from './types.js';
import { getObservations } from '../ranking/utils.js';

const BASE_WEIGHT_SCORE = 50;

export const providerWeightSignal: SignalEvaluator = {
  name: 'ProviderWeightSignal',
  evaluate: (resource, context: RankingContext) => {
    const observations = getObservations(resource);
    if (observations.length === 0) return null;

    // Find the highest provider weight among all observations
    let maxWeight = 0;
    let bestProvider = '';

    for (const obs of observations) {
      const weight = context.providerWeights[obs.provider] ?? 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        bestProvider = obs.provider;
      }
    }

    if (maxWeight > 0) {
      return {
        signal: 'ProviderWeightSignal',
        scoreContribution: maxWeight * BASE_WEIGHT_SCORE,
        explanation: `High trust source (${bestProvider})`,
        debugMetadata: { maxWeight, bestProvider }
      };
    }

    return null;
  }
};
