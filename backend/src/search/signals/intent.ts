import { SignalEvaluator, RankingContext } from './types.js';

export const intentSignal: SignalEvaluator = {
  name: 'IntentSignal',
  evaluate: (resource, context: RankingContext) => {
    if (context.intents.has(resource.entityType)) {
      return {
        signal: 'IntentSignal',
        scoreContribution: 500, // Massive boost for matching intent
        explanation: 'Matches search intent',
        debugMetadata: { matchedIntent: resource.entityType }
      };
    }
    return null;
  }
};
