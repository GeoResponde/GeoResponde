import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { HumanitarianProvider, Report } from '@georesponde/shared';

// Spy the transports so we can assert the dry-run path never touches the
// network. `vi.hoisted` lets the mock factories reference these safely.
const { postJson, fetchJson } = vi.hoisted(() => ({
  postJson: vi.fn(),
  fetchJson: vi.fn(),
}));
vi.mock('../../../transports/rest/postClient.js', () => ({ postJson }));
vi.mock('../../../transports/rest/client.js', () => ({ fetchJson }));

import { VenezuelaReportaAdapter } from '../adapter.js';

const load = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8'));

const PROVIDER: HumanitarianProvider = {
  id: 'prov-venezuelareporta',
  display_name: 'Venezuela Reporta',
  website: 'https://venezuelareporta.org/',
  description: '',
  logo: '',
  status: 'active',
  adapter: 'VenezuelaReportaAdapter',
  capabilities: ['search', 'submission'],
};

describe('VenezuelaReportaAdapter.submit (dry-run default)', () => {
  const request = load('submission.request.json') as Report;

  beforeEach(() => {
    postJson.mockReset();
    fetchJson.mockReset();
    delete process.env.GEORESPONDE_SUBMIT_LIVE;
    delete process.env.VENEZUELAREPORTA_API_KEY;
  });

  it('advertises the submission capability for missing-person', () => {
    const adapter = new VenezuelaReportaAdapter(PROVIDER);
    expect(adapter.submissionMode).toBe('api');
    expect(adapter.submissionTopics).toContain('missing-person');
  });

  it('returns a preview and makes NO network call by default', async () => {
    const adapter = new VenezuelaReportaAdapter(PROVIDER);
    const result = await adapter.submit(request, { idempotencyKey: 'vr-key-1' });

    expect(postJson).not.toHaveBeenCalled();
    expect(result.mode).toBe('dry-run');
    expect(result.status).toBe('ok');
    expect(result.idempotencyKey).toBe('vr-key-1');
  });

  it('never leaks the cédula into the preview or the envelope', async () => {
    const adapter = new VenezuelaReportaAdapter(PROVIDER);
    const result = await adapter.submit(request, { idempotencyKey: 'vr-key-1' });
    expect(JSON.stringify(result)).not.toContain('00099887');
    expect(result.preview).not.toHaveProperty('cedula');
  });

  it('errors WITHOUT a network call when a required field is missing', async () => {
    const adapter = new VenezuelaReportaAdapter(PROVIDER);
    const bad = { ...request, fields: { ...request.fields, fullName: '' } } as Report;
    const result = await adapter.submit(bad, { idempotencyKey: 'vr-key-1' });

    expect(postJson).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('skips (never sends) when live is requested but unconfigured', async () => {
    const adapter = new VenezuelaReportaAdapter(PROVIDER);
    const result = await adapter.submit(request, {
      dryRun: false,
      idempotencyKey: 'vr-key-1',
    });

    expect(postJson).not.toHaveBeenCalled();
    expect(result.status).toBe('skipped');
    expect(JSON.stringify(result)).not.toContain('00099887');
  });
});
