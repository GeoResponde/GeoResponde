import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Report, SubmissionReport } from '@georesponde/shared';
import { buildApp } from '../../index.js';

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'test-report-1',
    topic: 'resource-need',
    createdAt: '2026-07-01T00:00:00.000Z',
    fields: { resourceType: 'water', location: 'Caracas' },
    consent: { targets: [], acknowledgedAt: '2026-07-01T00:00:00.000Z' },
    ...overrides,
  };
}

describe('POST /api/report (submission router)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and a SubmissionReport for a valid report', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/report',
      payload: makeReport(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as SubmissionReport;
    expect(body.topic).toBe('resource-need');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.summary).toEqual({
      ok: expect.any(Number),
      skipped: expect.any(Number),
      error: expect.any(Number),
    });
    // A report-level idempotency key is minted by the router (not the client id).
    expect(typeof body.idempotencyKey).toBe('string');
    expect(body.idempotencyKey).not.toBe('test-report-1');
    expect(typeof body.elapsedMs).toBe('number');
  });

  it('returns HTTP 400 for an unknown topic without throwing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/report',
      payload: makeReport({ topic: 'not-a-topic' as Report['topic'] }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts ?dryRun=0 and still returns a SubmissionReport (opt into live)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/report?dryRun=0',
      payload: makeReport(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as SubmissionReport;
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('does not surface a sensitive cedula or reporter contact in the response envelope', async () => {
    const report = makeReport({
      topic: 'missing-person',
      fields: { fullName: 'Ana', cedula: 'V-12345678' },
      reporter: { contact: 'ana@example.com' },
    });
    const res = await app.inject({ method: 'POST', url: '/api/report', payload: report });
    const body = res.json() as SubmissionReport;
    expect(JSON.stringify(body)).not.toContain('ana@example.com');
    expect(JSON.stringify(body)).not.toContain('V-12345678');
  });
});
