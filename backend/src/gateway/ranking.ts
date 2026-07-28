import type { NormalizedSearchResult, CandidateEntity } from '@georesponde/shared';

/**
 * Relevance ranking for federated search results (issue #19).
 *
 * The gateway fans out to every provider, flattens, and de-duplicates, but the
 * surviving results come back in provider/merge order, not in an order that
 * helps a responder or a family. This module scores each result and sorts by
 * that score so the most relevant, best-corroborated, most complete records
 * surface first.
 *
 * The scoring is a pure function of the result and the query, with no clock and
 * no external state, so it is deterministic and easy to unit test. Recency is
 * used only as a tiebreaker (it needs no reference "now"), and the original
 * order is the final tiebreaker so the sort is stable.
 *
 * Signal priority (agreed on #19), highest to lowest:
 *   1. Query match   2. Corroboration   3. Structured data   4. Confidence   5. Recency
 * The weight bands below keep that ordering: a full-token title match dominates
 * any amount of corroboration, corroboration outweighs structured completeness,
 * and so on.
 */

/** Query-match weights (dominant signal). */
const MATCH_EXACT = 1000;
const MATCH_ALL_TOKENS = 600;
const MATCH_PARTIAL_MAX = 300; // scaled by the fraction of query tokens found

/** Corroboration: each extra provider that also reported this entity. */
const CORROBORATION_PER_SOURCE = 40;
const CORROBORATION_MAX_SOURCES = 5; // cap so a swarm of aggregators can't dominate

/** Structured-data completeness bonuses. */
const STRUCT_CEDULA = 30;
const STRUCT_AGE = 15;
const STRUCT_COORDS = 15;

/** Provider-declared confidence (0..1) scaled into a small band. */
const CONFIDENCE_WEIGHT = 20;

/** Strip accents/punctuation, lowercase, and split into tokens. */
function tokenize(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Normalized single string (for exact comparison). */
function normalizeText(value: unknown): string {
  return tokenize(value).join(' ');
}

/** Match one normalized candidate string against the query. */
function matchOne(candidateNorm: string, queryTokens: string[], queryNorm: string): number {
  if (candidateNorm.length === 0) return 0;
  if (candidateNorm === queryNorm) return MATCH_EXACT;

  const candidateTokens = new Set(candidateNorm.split(' '));
  const found = queryTokens.filter((t) => candidateTokens.has(t)).length;
  if (found === queryTokens.length) return MATCH_ALL_TOKENS;
  if (found === 0) return 0;
  return Math.round(MATCH_PARTIAL_MAX * (found / queryTokens.length));
}

/**
 * How well the result matches the query. The title and the structured full name
 * are scored independently and the best is taken, so a record that repeats its
 * name in both fields is not penalized (it would otherwise never look "exact").
 */
function matchScore(result: NormalizedSearchResult, queryTokens: string[], queryNorm: string): number {
  if (queryTokens.length === 0) return 0;
  return Math.max(
    matchOne(normalizeText(result.title), queryTokens, queryNorm),
    matchOne(normalizeText(result.person?.fullName), queryTokens, queryNorm),
  );
}

function corroborationScore(candidate: CandidateEntity): number {
  const extra = Math.max(0, Math.min(candidate.observations.length - 1, CORROBORATION_MAX_SOURCES));
  return extra * CORROBORATION_PER_SOURCE;
}

function structuredScore(result: NormalizedSearchResult): number {
  let s = 0;
  if (result.person?.cedula) s += STRUCT_CEDULA;
  if (typeof result.person?.age === 'number') s += STRUCT_AGE;
  if (Array.isArray(result.location) && result.location.length === 2) s += STRUCT_COORDS;
  return s;
}

function confidenceScore(result: NormalizedSearchResult): number {
  const c = typeof result.confidence === 'number' ? result.confidence : 0;
  return Math.max(0, Math.min(1, c)) * CONFIDENCE_WEIGHT;
}

/** Total relevance score for one candidate against the query. Exported for tests. */
export function scoreResult(
  candidate: CandidateEntity,
  queryTokens: string[],
  queryNorm: string,
): number {
  // Score the best observation inside the candidate for textual match and structured completeness
  const obsScores = candidate.observations.map(obs => {
    const result = obs.normalizedFields;
    return (
      matchScore(result, queryTokens, queryNorm) +
      structuredScore(result) +
      confidenceScore(result)
    );
  });
  const bestObsScore = obsScores.length > 0 ? Math.max(...obsScores) : 0;

  return bestObsScore + corroborationScore(candidate);
}

/** Epoch ms for a candidate's updatedAt, or -Infinity when absent/unparsable. */
function updatedAt(candidate: CandidateEntity): number {
  if (!candidate.updatedAt) return -Infinity;
  const t = Date.parse(candidate.updatedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Return a new array of the results ordered by relevance (highest first).
 * Ties on score break by recency (newer first), then by original order so the
 * sort is stable. Never mutates the input.
 */
export function rankResults(
  candidates: CandidateEntity[],
  query: string,
): CandidateEntity[] {
  const queryTokens = tokenize(query);
  const queryNorm = queryTokens.join(' ');

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreResult(candidate, queryTokens, queryNorm),
      updated: updatedAt(candidate),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.updated !== a.updated) return b.updated - a.updated;
      return a.index - b.index;
    })
    .map((entry) => entry.candidate);
}
