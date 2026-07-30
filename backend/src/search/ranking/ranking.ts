import { UnifiedSearchResource, RankingExplanation } from '@georesponde/shared';
import { RankingContext, SignalEvaluator } from '../signals/types.js';
import { intentSignal } from '../signals/intent.js';
import { exactMatchSignal } from '../signals/exactMatch.js';
import { providerWeightSignal } from '../signals/providerWeight.js';
import { providerConfidenceSignal } from '../signals/providerConfidence.js';
import { corroborationSignal } from '../signals/corroboration.js';
import { recencySignal } from '../signals/recency.js';

const ALL_SIGNALS: SignalEvaluator[] = [
  intentSignal,
  exactMatchSignal,
  providerWeightSignal,
  providerConfidenceSignal,
  corroborationSignal,
  recencySignal
];

/** Epoch ms for a candidate's updatedAt, or -Infinity when absent/unparsable. */
function updatedAtMs(resource: UnifiedSearchResource): number {
  if (!resource.updatedAt) return -Infinity;
  const t = Date.parse(resource.updatedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

export function rankResources(
  resources: UnifiedSearchResource[],
  context: RankingContext,
  signals: SignalEvaluator[] = ALL_SIGNALS
): UnifiedSearchResource[] {
  // 1. Evaluate signals for each resource
  for (const resource of resources) {
    let totalScore = 0;
    const explanations: RankingExplanation[] = [];

    for (const signal of signals) {
      try {
        const result = signal.evaluate(resource, context);
        if (result && result.scoreContribution > 0) {
          totalScore += result.scoreContribution;
          explanations.push(result);
        }
      } catch (err) {
        console.error(`[Ranking] Error evaluating signal ${signal.name}`, err);
      }
    }

    resource.relevanceScore = totalScore;
    resource.rankingExplanations = explanations;
  }

  // 2. Sort by relevance (highest first), breaking ties with recency, then ID.
  resources.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const aUpdated = updatedAtMs(a);
    const bUpdated = updatedAtMs(b);
    if (aUpdated !== bUpdated) {
      return bUpdated - aUpdated;
    }
    return a.id.localeCompare(b.id);
  });

  return resources;
}
