import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import type { HumanitarianProvider, Report } from '@georesponde/shared';
import { ProviderGateway } from '../ProviderGateway.js';
import { MockHumanitarianAdapter } from '../../testing/MockHumanitarianAdapter.js';
import type { BaseAdapter } from '../../adapters/BaseAdapter.js';

function makeProvider(id: string): HumanitarianProvider {
  return {
    id,
    display_name: id,
    website: `https://${id}.example/`,
    description: '',
    logo: '',
    status: 'active',
    adapter: 'MockHumanitarianAdapter',
    capabilities: ['submission'],
  };
}

function gatewayWith(adapters: BaseAdapter[], logger: unknown): ProviderGateway {
  const gateway = new ProviderGateway();
  (gateway as unknown as { setLogger: (l: unknown) => void }).setLogger(logger);
  const map = (gateway as unknown as { adapters: Map<string, BaseAdapter> }).adapters;
  for (const a of adapters) map.set(a.provider.id, a);
  return gateway;
}

// Synthetic PII markers — never real data.
const FAKE_CEDULA = 'V-99887766';
const NOTE_TEXT = 'seen-near-the-old-bridge-note';
const REPORTER_CONTACT = 'reporter-synthetic@example.test';

function makeReport(): Report {
  return {
    id: 'report-stateless-1',
    topic: 'missing-person',
    createdAt: '2026-07-01T00:00:00.000Z',
    fields: {
      fullName: 'Synthetic Person',
      cedula: FAKE_CEDULA,
      description: NOTE_TEXT,
      lastSeenCoords: [10.5, -66.9],
    },
    consent: { targets: ['accept-1'], acknowledgedAt: '2026-07-01T00:00:00.000Z' },
    reporter: { contact: REPORTER_CONTACT },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('gateway.submit statelessness + PII-free audit-lite', () => {
  it('emits exactly one audit-lite line with no report content or URL', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const gateway = gatewayWith(
      [new MockHumanitarianAdapter(makeProvider('accept-1'))],
      logger,
    );

    const report = await gateway.submit(makeReport());

    expect(logger.info).toHaveBeenCalledTimes(1);
    const line = logger.info.mock.calls[0][0];
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain(FAKE_CEDULA);
    expect(serialized).not.toContain(NOTE_TEXT);
    expect(serialized).not.toContain(REPORTER_CONTACT);
    expect(serialized).not.toContain('Synthetic Person');
    expect(serialized).not.toContain('http');
    expect(serialized).not.toContain('mailto:');
    expect(serialized).not.toContain('66.9');

    // Structured audit fields.
    expect(line.topic).toBe('missing-person');
    expect(line.targetProviderIds).toEqual(['accept-1']);
    expect(line.outcomes).toEqual(report.summary);
    expect(typeof line.elapsedMs).toBe('number');
    expect(typeof line.idempotencyKeyHash).toBe('string');
  });

  it('logs a salted hash, never the raw report-level key', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const gateway = gatewayWith(
      [new MockHumanitarianAdapter(makeProvider('accept-1'))],
      logger,
    );

    const report = await gateway.submit(makeReport());
    const line = logger.info.mock.calls[0][0];
    expect(line.idempotencyKeyHash).not.toBe(report.idempotencyKey);
    expect(line.idempotencyKeyHash.length).toBeGreaterThan(0);
  });

  it('exposes the four-field PII-free receipt on an accepted live result', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const gateway = gatewayWith(
      [new MockHumanitarianAdapter(makeProvider('accept-1'))],
      logger,
    );

    const report = await gateway.submit(makeReport(), { dryRun: false });
    const result = report.results[0];
    expect(result.provider).toBe('accept-1');
    expect(result.receipt?.remoteId).toBeTruthy();
    expect(result.receipt?.timestamp).toBeTruthy();
    // The four REP-05 receipt fields (remoteId, url, provider, timestamp) are reachable.
    expect(result.receipt).toHaveProperty('url');
  });

  it('performs no fs write during submit', async () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const gateway = gatewayWith(
      [new MockHumanitarianAdapter(makeProvider('accept-1'))],
      logger,
    );

    await gateway.submit(makeReport());
    expect(writeSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
