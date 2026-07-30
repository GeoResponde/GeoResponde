import { NormalizedSearchResult, UnifiedSearchResource, HumanitarianProvider } from '@georesponde/shared';
import { resolutionIndex } from '../../resolution/ResolutionIndex.js';
import { detectIntents } from '../intent/detector.js';
import { rankResources } from '../ranking/ranking.js';
import { RankingContext } from '../signals/types.js';
import { normalizeText, tokenize } from '../ranking/utils.js';

export function executeSearchPipeline(
  query: string, 
  federatedResults: NormalizedSearchResult[],
  providers: HumanitarianProvider[]
): UnifiedSearchResource[] {
  // 1. Detect intents
  const intents = detectIntents(query);

  // 2. Separate resources that need entity resolution from those that bypass it
  const resolutionEligible: NormalizedSearchResult[] = [];
  const bypassResolution: NormalizedSearchResult[] = [];

  for (const result of federatedResults) {
    // Currently, only 'person' entities are resolved. 
    // This allows shelters, hospitals, etc. to pass through.
    if (result.type === 'person') {
      resolutionEligible.push(result);
    } else {
      bypassResolution.push(result);
    }
  }

  const unifiedResources: UnifiedSearchResource[] = [];

  // 3. Resolve eligible entities
  if (resolutionEligible.length > 0) {
    const candidates = resolutionIndex.resolve(resolutionEligible);
    for (const candidate of candidates) {
      unifiedResources.push({
        id: candidate.id,
        entityType: candidate.entityType,
        candidate,
        relevanceScore: 0,
        rankingExplanations: [],
        updatedAt: candidate.updatedAt
      });
    }
  }

  // 4. Pass-through remaining resources
  for (const result of bypassResolution) {
    unifiedResources.push({
      id: result.provider_id || crypto.randomUUID(),
      entityType: result.type || 'unknown',
      result,
      relevanceScore: 0,
      rankingExplanations: [],
      updatedAt: result.last_update
    });
  }

  // 5. Build Ranking Context
  const providerWeights: Record<string, number> = {};
  for (const p of providers) {
    // Read optional weight from provider catalog metadata, default to 1.0
    // @ts-expect-error metadata is loosely typed
    const weight = p.metadata?.rankingWeight != null ? Number(p.metadata.rankingWeight) : 1.0;
    providerWeights[p.id] = Number.isNaN(weight) ? 1.0 : weight;
  }

  const context: RankingContext = {
    queryTokens: tokenize(query),
    queryNorm: normalizeText(query),
    intents,
    providerWeights
  };

  // 6. Rank all unified resources
  return rankResources(unifiedResources, context);
}
