import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchRemixSingleFetch } from '../client.js';

describe('Remix Transport', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('times out if the stream body is slow to download', async () => {
    // We mock fetch to return immediately (headers received), 
    // but the body is a very slow ReadableStream that takes longer than the timeout.
    global.fetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      const slowStream = new ReadableStream({
        async start(controller) {
          // Listen for the abort signal and throw an error to simulate browser fetch aborting the stream.
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              controller.error(new Error('AbortError'));
            });
          }

          // Wait 200ms before sending the first chunk (longer than the 100ms timeout)
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (options?.signal?.aborted) return;
          
          controller.enqueue(new TextEncoder().encode('0:["$","meta"]'));
          controller.close();
        },
      });

      return {
        ok: true,
        status: 200,
        body: slowStream,
      } as unknown as Response;
    });

    const startTime = Date.now();
    await expect(
      fetchRemixSingleFetch('https://example.com', 'test', {}, 100) // 100ms timeout
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    // It should timeout near 100ms, definitely before the 200ms chunk arrives.
    expect(elapsed).toBeLessThan(180);
  });
});
