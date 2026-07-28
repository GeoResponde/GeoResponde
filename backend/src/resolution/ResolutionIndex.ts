import type { NormalizedSearchResult, Observation, CandidateEntity } from '@georesponde/shared';
import { ResolutionEngine } from './ResolutionEngine.js';
import { ExactIdentifierStrategy } from './strategies/ExactIdentifierStrategy.js';
import crypto from 'crypto';
import { normalizeCedula } from '../adapters/person.js';

export class ResolutionIndex {
  private engine: ResolutionEngine;

  constructor() {
    this.engine = new ResolutionEngine();
    this.engine.use(new ExactIdentifierStrategy());
  }

  /**
   * Main entrypoint for the gateway. Converts normalized results to Observations,
   * runs the Resolution Engine, and returns CandidateEntities.
   */
  public resolve(results: NormalizedSearchResult[]): CandidateEntity[] {
    const observations = results.map(res => this.ingest(res));
    return this.engine.resolve(observations);
  }

  /**
   * Ingests a provider-centric NormalizedSearchResult into a generic Observation,
   * extracting domain-specific fields into generic identityHints.
   */
  private ingest(result: NormalizedSearchResult): Observation {
    const hints: Record<string, string[]> = {};

    // Domain-specific extraction logic lives HERE, not in the Engine.
    // We normalize the cédula to ensure exact string matching works.
    if (result.type === 'person' && result.person?.cedula) {
      const normalized = normalizeCedula(result.person.cedula);
      if (normalized) {
        hints['national_id'] = [normalized];
      }
    }

    // Future: Extract OSM IDs for shelters, phone numbers, etc.

    return {
      id: crypto.randomUUID(),
      provider: result.provider,
      providerRecordId: result.provider_id || crypto.randomUUID(),
      entityType: result.type || 'unknown',
      identityHints: hints,
      normalizedFields: result,
      sourceUrl: result.url,
      observedAt: result.last_update || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const resolutionIndex = new ResolutionIndex();
