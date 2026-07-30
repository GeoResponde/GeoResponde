import { UnifiedSearchResource, RankingExplanation } from '@georesponde/shared';

export interface RankingContext {
  queryTokens: string[];
  queryNorm: string;
  intents: Set<string>;
  providerWeights: Record<string, number>;
}

export interface SignalEvaluator {
  name: string;
  evaluate: (resource: UnifiedSearchResource, context: RankingContext) => RankingExplanation | null;
}
