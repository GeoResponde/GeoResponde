import { UnifiedSearchResource } from '@georesponde/shared';
import type { NormalizedSearchResult } from '@georesponde/shared';

export function getObservations(resource: UnifiedSearchResource): NormalizedSearchResult[] {
  if (resource.candidate) {
    return resource.candidate.observations.map(obs => obs.normalizedFields);
  }
  if (resource.result) {
    return [resource.result];
  }
  return [];
}

/** Strip accents/punctuation, lowercase, and split into tokens. */
export function tokenize(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function normalizeText(value: unknown): string {
  return tokenize(value).join(' ');
}
