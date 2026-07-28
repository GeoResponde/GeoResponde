import { NormalizedSearchResult } from '@georesponde/shared';
import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import { HumanitarianProvider, Report, SubmissionResult } from '@georesponde/shared';
import crypto from 'crypto';

export class MockResolutionAdapter implements BaseAdapter {
  constructor(public provider: HumanitarianProvider) {}

  async submit(report: Report, opts?: SubmitOptions): Promise<SubmissionResult> {
    return {
      provider: this.provider.id,
      mode: opts?.dryRun ? 'dry-run' : 'live',
      status: 'error',
      error: 'MockResolutionAdapter does not support submissions',
      idempotencyKey: opts?.idempotencyKey,
    };
  }
  async search(query: string, domain?: string): Promise<NormalizedSearchResult[]> {
    if (query.toLowerCase() !== 'resolution-test') {
      return [];
    }

    // SCENARIO 1: Deterministic Match
    // Two observations sharing the same cédula (should group into 1 CandidateEntity)
    const match1: NormalizedSearchResult = {
      provider: 'Mock Provider A',
      provider_id: `scenario-1a-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Ana Test Match',
      url: 'http://localhost/a',
      person: { cedula: 'V-11111111', status: 'missing' },
      last_update: new Date().toISOString(),
    };
    const match2: NormalizedSearchResult = {
      provider: 'Mock Provider B',
      provider_id: `scenario-1b-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Ana Test Match (Duplicate)',
      url: 'http://localhost/b',
      person: { cedula: '11111111', status: 'missing' },
      last_update: new Date().toISOString(),
    };

    // SCENARIO 2: Different Identities
    // Two observations with completely different cédulas (should remain 2 distinct Candidates)
    const diff1: NormalizedSearchResult = {
      provider: 'Mock Provider A',
      provider_id: `scenario-2a-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Carlos Different',
      url: 'http://localhost/c',
      person: { cedula: 'V-22222222' },
      last_update: new Date().toISOString(),
    };
    const diff2: NormalizedSearchResult = {
      provider: 'Mock Provider B',
      provider_id: `scenario-2b-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Carlos Different',
      url: 'http://localhost/d',
      person: { cedula: 'V-33333333' },
      last_update: new Date().toISOString(),
    };

    // SCENARIO 3: Conflicting Information
    // Same identity, but conflicting statuses (should group, but UI shows conflict)
    const conflict1: NormalizedSearchResult = {
      provider: 'Mock Provider A',
      provider_id: `scenario-3a-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Diana Conflict',
      url: 'http://localhost/e',
      person: { cedula: 'V-44444444', status: 'missing' },
      last_update: new Date().toISOString(),
    };
    const conflict2: NormalizedSearchResult = {
      provider: 'Mock Provider B',
      provider_id: `scenario-3b-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Diana Conflict',
      url: 'http://localhost/f',
      person: { cedula: 'V-44444444', status: 'hospitalized' },
      last_update: new Date().toISOString(),
    };

    // SCENARIO 4: Missing Identity Hint
    // No identity hint provided (should be standalone, no matches attempted)
    const standalone: NormalizedSearchResult = {
      provider: 'Mock Provider C',
      provider_id: `scenario-4-${crypto.randomUUID()}`,
      type: 'person',
      title: 'Eduardo Standalone',
      url: 'http://localhost/g',
      person: { }, // no cedula
      last_update: new Date().toISOString(),
    };

    return [match1, match2, diff1, diff2, conflict1, conflict2, standalone];
  }
}
