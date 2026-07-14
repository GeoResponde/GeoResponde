import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../index.js';

describe('SEC-01: dev diagnostic routes are gated out of production', () => {
  const originalEnv = process.env.NODE_ENV;
  let app: FastifyInstance;

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    if (app) await app.close();
  });

  it('404s /api/dev/inspect/:id when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    app = buildApp();
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/dev/inspect/prov-hdx' });
    expect(res.statusCode).toBe(404);
  });

  it('404s /api/dev/inspect-legacy/venezuelatebusca when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    app = buildApp();
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/dev/inspect-legacy/venezuelatebusca' });
    expect(res.statusCode).toBe(404);
  });

  it('registers /api/dev/inspect/:id outside production', async () => {
    process.env.NODE_ENV = 'test';
    app = buildApp();
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/dev/inspect/prov-hdx' });
    expect(res.statusCode).not.toBe(404);
  });
});

describe('SEC-02: rate limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests once the per-client limit is exceeded', async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 65; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      if (res.statusCode === 429) {
        sawTooManyRequests = true;
        break;
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});

describe('SEC-03: security response headers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets baseline security headers on responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('SEC-06: CORS falls back permissively but warns in production', () => {
  it('logs a warning and still reflects any origin when unset in production', async () => {
    const { resolveCorsOrigin } = await import('../../config/cors.js');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const origin = resolveCorsOrigin({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('CORS_ALLOWED_ORIGINS'));
    expect(origin).toBe(true); // dev-permissive fallback is unchanged, just now loud
    spy.mockRestore();
  });

  it('does not warn outside production', async () => {
    const { resolveCorsOrigin } = await import('../../config/cors.js');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveCorsOrigin({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
