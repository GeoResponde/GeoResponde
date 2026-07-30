import { SignalEvaluator, RankingContext } from './types.js';

export const recencySignal: SignalEvaluator = {
  name: 'RecencySignal',
  evaluate: (resource, context: RankingContext) => {
    // Recency is typically a tie-breaker. We can assign a small score boost 
    // or keep it just as a sort comparator in the pipeline.
    // For now, we return 0 so it doesn't skew main ranking, 
    // but the pipeline will use resource.updatedAt for sorting.
    
    // We could parse the date and give a small boost if it's within the last 24h.
    if (!resource.updatedAt) return null;
    
    const timeMs = Date.parse(resource.updatedAt);
    if (Number.isNaN(timeMs)) return null;

    const ageMs = Date.now() - timeMs;
    const hours24 = 24 * 60 * 60 * 1000;

    if (ageMs < hours24) {
      return {
        signal: 'RecencySignal',
        scoreContribution: 10,
        explanation: 'Recently updated',
        debugMetadata: { ageMs }
      };
    }

    return null;
  }
};
