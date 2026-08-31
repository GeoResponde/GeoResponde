import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../index.js';
import { ProviderGateway } from '../ProviderGateway.js';
import { HEALTH_PROBE_QUERY } from '../health/HealthProbeService.js';

const SNAPSHOT_KEYS = ['averageLatencyMs', 'lastSuccessAt', 'consecutiveFailures', 'samples', 'up', 'total', 'providerStatus', 'lastErrorDetail', 'lastSuccessfulDataRetrievalAt'].sort();

describe('GET /api/health/providers', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('returns 200 with a stable per-provider snapshot shape and no query/sample/payload/error field', async () => {
    vi.spyOn(ProviderGateway.prototype, 'inspect').mockImplementation(async (id: string) => ({
      providerId: id,
      status: 'ok' as const,
      normalizedResults: 1,
      elapsedMs: 5,
    }));

    const app: FastifyInstance = buildApp();
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health/providers' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      const providerIds = Object.keys(body);
      expect(providerIds.length).toBeGreaterThan(0);

      for (const id of providerIds) {
        const snapshot = body[id] as Record<string, unknown>;
        expect(Object.keys(snapshot).sort()).toEqual(SNAPSHOT_KEYS);
        expect(snapshot).not.toHaveProperty('query');
        expect(snapshot).not.toHaveProperty('sample');
        expect(snapshot).not.toHaveProperty('payload');
        expect(snapshot).not.toHaveProperty('error');
        expect(snapshot).not.toHaveProperty('normalizedResults');
      }
    } finally {
      await app.close();
    }
  });

  it('is degrade-safe: an adapter that throws is reported down, endpoint still returns 200', async () => {
    vi.spyOn(ProviderGateway.prototype, 'inspect').mockImplementation(async (id: string, _query: string) => {
      throw new Error(`adapter ${id} exploded`);
    });

    const app: FastifyInstance = buildApp();
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health/providers' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, { consecutiveFailures: number; samples: { outcome: string }[] }>;
      const ids = Object.keys(body);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(body[id].consecutiveFailures).toBeGreaterThanOrEqual(1);
        expect(body[id].samples.some((s) => s.outcome === 'down')).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it('never leaks the probe query token or a query/sample key in the response body', async () => {
    vi.spyOn(ProviderGateway.prototype, 'inspect').mockImplementation(async (id: string) => ({
      providerId: id,
      status: 'ok' as const,
      normalizedResults: 1,
      elapsedMs: 5,
    }));

    const app: FastifyInstance = buildApp();
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health/providers' });
      const raw = JSON.stringify(res.json());
      expect(raw).not.toContain(HEALTH_PROBE_QUERY);
      expect(raw).not.toContain('"query"');
      expect(raw).not.toContain('"sample"');
    } finally {
      await app.close();
    }
  });

  it('never leaks the probe query token in gateway logs during a probe', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(ProviderGateway.prototype, 'inspect').mockImplementation(async (id: string) => {
      throw new Error(`adapter ${id} exploded`);
    });

    const app: FastifyInstance = buildApp();
    await app.ready();
    try {
      await app.inject({ method: 'GET', url: '/api/health/providers' });
      const logged = writeSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).not.toContain(HEALTH_PROBE_QUERY);
    } finally {
      await app.close();
      writeSpy.mockRestore();
    }
  });

  it('throttles real probes: a second immediate GET does not re-probe (call count stays flat)', async () => {
    const inspectSpy = vi.spyOn(ProviderGateway.prototype, 'inspect').mockImplementation(async (id: string) => ({
      providerId: id,
      status: 'ok' as const,
      normalizedResults: 1,
      elapsedMs: 5,
    }));

    const app: FastifyInstance = buildApp();
    await app.ready();
    try {
      const res1 = await app.inject({ method: 'GET', url: '/api/health/providers' });
      const callsAfterFirst = inspectSpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: '/api/health/providers' });
      expect(res2.statusCode).toBe(200);
      expect(inspectSpy.mock.calls.length).toBe(callsAfterFirst);

      // Sample counts must not grow on the throttled second call either.
      const body1 = res1.json() as Record<string, { total: number }>;
      const body2 = res2.json() as Record<string, { total: number }>;
      for (const id of Object.keys(body1)) {
        expect(body2[id].total).toBe(body1[id].total);
      }
    } finally {
      await app.close();
    }
  });
});
