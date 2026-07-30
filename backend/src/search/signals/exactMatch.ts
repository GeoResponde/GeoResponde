import { SignalEvaluator, RankingContext } from './types.js';
import { getObservations, normalizeText } from '../ranking/utils.js';

const MATCH_EXACT = 1000;
const MATCH_ALL_TOKENS = 600;
const MATCH_PARTIAL_MAX = 300;

function matchOne(candidateNorm: string, queryTokens: string[], queryNorm: string): number {
  if (candidateNorm.length === 0) return 0;
  if (candidateNorm === queryNorm) return MATCH_EXACT;

  const candidateTokens = new Set(candidateNorm.split(' '));
  const found = queryTokens.filter((t) => candidateTokens.has(t)).length;
  if (found === queryTokens.length) return MATCH_ALL_TOKENS;
  if (found === 0) return 0;
  return Math.round(MATCH_PARTIAL_MAX * (found / queryTokens.length));
}

export const exactMatchSignal: SignalEvaluator = {
  name: 'ExactMatchSignal',
  evaluate: (resource, context: RankingContext) => {
    if (context.queryTokens.length === 0) return null;

    const observations = getObservations(resource);
    let maxScore = 0;
    let explanation = '';

    for (const obs of observations) {
      const titleNorm = normalizeText(obs.title);
      const personNorm = normalizeText(obs.person?.fullName);
      
      const titleScore = matchOne(titleNorm, context.queryTokens, context.queryNorm);
      const personScore = matchOne(personNorm, context.queryTokens, context.queryNorm);
      
      const currentMax = Math.max(titleScore, personScore);
      if (currentMax > maxScore) {
        maxScore = currentMax;
        if (maxScore === MATCH_EXACT) explanation = 'Exact match';
        else if (maxScore === MATCH_ALL_TOKENS) explanation = 'Contains all search terms';
        else explanation = 'Partial match';
      }
    }

    if (maxScore > 0) {
      return {
        signal: 'ExactMatchSignal',
        scoreContribution: maxScore,
        explanation,
        debugMetadata: { maxScore }
      };
    }

    return null;
  }
};
