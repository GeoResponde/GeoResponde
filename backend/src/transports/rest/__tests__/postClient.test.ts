import { describe, it, expect, vi, afterEach } from 'vitest';
import { postJson } from '../postClient.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('postJson headers', () => {
  it('sends POST with Content-Type/Accept/User-Agent and Idempotency-Key when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await postJson('https://api.example/submit', { hello: 'world' }, { idempotencyKey: 'key-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/submit');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Accept']).toBe('application/json');
    expect(init.headers['User-Agent']).toBe('GeoResponde-Gateway/1.0');
    expect(init.headers['Idempotency-Key']).toBe('key-1');
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('omits Idempotency-Key when none is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await postJson('https://api.example/submit', {});

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('postJson retry policy', () => {
  it('retries exactly once on 503 when an idempotency key is present, returning the second response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: 'unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postJson<{ ok: boolean }>('https://api.example/submit', {}, { idempotencyKey: 'key-1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('retries once on a network error when an idempotency key is present', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postJson('https://api.example/submit', {}, { idempotencyKey: 'key-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it('does NOT retry a 400 (attempts === 1) and returns the 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'bad request' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postJson('https://api.example/submit', {}, { idempotencyKey: 'key-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(400);
  });

  it('does NOT retry a 503 when no idempotency key is present (attempts === 1)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postJson('https://api.example/submit', {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
  });

  it('does NOT retry when retryable is explicitly false, even with a key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postJson('https://api.example/submit', {}, { idempotencyKey: 'key-1', retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
  });
});
