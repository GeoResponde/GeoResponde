import { describe, it, expect } from 'vitest';
import type { HumanitarianProvider, Report } from '@georesponde/shared';
import { ProviderGateway } from '../ProviderGateway.js';
import { MockHumanitarianAdapter, type MockAdapterOptions } from '../../testing/MockHumanitarianAdapter.js';
import type { BaseAdapter } from '../../adapters/BaseAdapter.js';

function makeProvider(id: string, capabilities: string[]): HumanitarianProvider {
  return {
    id,
    display_name: id,
    website: `https://${id}.example/`,
    description: '',
    logo: '',
    status: 'active',
    adapter: 'MockHumanitarianAdapter',
    capabilities,
  };
}

function makeMock(id: string, capabilities: string[], options: MockAdapterOptions = {}): MockHumanitarianAdapter {
  return new MockHumanitarianAdapter(makeProvider(id, capabilities), options);
}

/** Inject adapters directly into a gateway's private map (no catalog boot). */
function gatewayWith(adapters: BaseAdapter[]): ProviderGateway {
  const gateway = new ProviderGateway();
  const map = (gateway as unknown as { adapters: Map<string, BaseAdapter> }).adapters;
  for (const a of adapters) map.set(a.provider.id, a);
  return gateway;
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-abc',
    topic: 'missing-person',
    createdAt: '2026-07-01T00:00:00.000Z',
    fields: { fullName: 'Ana' },
    consent: { targets: [], acknowledgedAt: '2026-07-01T00:00:00.000Z' },
    ...overrides,
  };
}

describe('ProviderGateway.submit router', () => {
  it('fans out to two accepting targets on the report topic', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('accept-2', ['submission']),
    ]);
    const report = gateway.submit(makeReport());
    const result = await report;
    expect(result.results).toHaveLength(2);
    expect(result.summary.ok).toBe(2);
    expect(result.summary.error).toBe(0);
    expect(result.topic).toBe('missing-person');
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('isolates a throwing provider into status:error without throwing', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('boom', ['submission'], { failSubmit: true }),
    ]);
    const result = await gateway.submit(makeReport());
    expect(result.results).toHaveLength(2);
    expect(result.summary.ok).toBe(1);
    expect(result.summary.error).toBe(1);
    const failed = result.results.find((r) => r.status === 'error');
    expect(failed).toBeDefined();
    // The error carries a static reason, never report content.
    expect(JSON.stringify(failed)).not.toContain('Ana');
  });

  it('excludes a submission-capable adapter whose topics do not include the topic', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('wrong-topic', ['submission'], { submissionTopics: ['resource-need'] }),
    ]);
    const result = await gateway.submit(makeReport());
    expect(result.results).toHaveLength(1);
    expect(result.results[0].provider).toBe('accept-1');
  });

  it('excludes a search-only adapter with no submission capability', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('search-only', ['search']),
    ]);
    const result = await gateway.submit(makeReport());
    expect(result.results).toHaveLength(1);
    expect(result.results[0].provider).toBe('accept-1');
  });

  it('returns a summary equal to summarize(results)', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('accept-2', ['submission']),
      makeMock('boom', ['submission'], { failSubmit: true }),
    ]);
    const result = await gateway.submit(makeReport());
    const recomputed = { ok: 0, skipped: 0, error: 0 };
    for (const r of result.results) recomputed[r.status] += 1;
    expect(result.summary).toEqual(recomputed);
  });

  it('defaults to dry-run when opts.dryRun is omitted', async () => {
    const gateway = gatewayWith([makeMock('accept-1', ['submission'])]);
    const result = await gateway.submit(makeReport());
    expect(result.results[0].mode).toBe('dry-run');
  });

  it('opts into live only when dryRun is explicitly false', async () => {
    const gateway = gatewayWith([makeMock('accept-1', ['submission'])]);
    const result = await gateway.submit(makeReport(), { dryRun: false });
    expect(result.results[0].mode).toBe('live');
  });

  it('mints a report-level key distinct from report.id and echoes a per-provider key', async () => {
    const gateway = gatewayWith([
      makeMock('accept-1', ['submission']),
      makeMock('accept-2', ['submission']),
    ]);
    const result = await gateway.submit(makeReport());
    expect(result.idempotencyKey).not.toBe('report-abc');
    // Each result echoes its own per-provider derived key; keys differ per provider.
    const keys = result.results.map((r) => r.idempotencyKey);
    expect(keys.every((k) => typeof k === 'string' && k!.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(2);
  });

  it('stamps a per-provider key on an isolated failure result', async () => {
    const gateway = gatewayWith([makeMock('boom', ['submission'], { failSubmit: true })]);
    const result = await gateway.submit(makeReport());
    expect(result.results[0].status).toBe('error');
    expect(typeof result.results[0].idempotencyKey).toBe('string');
  });
});
