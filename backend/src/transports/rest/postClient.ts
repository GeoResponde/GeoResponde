/**
 * Generic REST/JSON POST transport (REP-04). Mirrors rest/client.ts (the GET
 * transport) but adds write semantics: a JSON body, an optional `Idempotency-Key`
 * header, a higher default write timeout, and at-most-one retry.
 *
 * Retry is deliberately conservative: it fires only on a network/timeout error
 * or a 502/503/504 AND only when an idempotency key is present (so a retried POST
 * cannot create a duplicate report) AND when `retryable !== false`. A 4xx is
 * never retried.
 */

export interface PostJsonOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  retryable?: boolean;
}

export interface PostJsonResponse<T = unknown> {
  status: number;
  body: T;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function attempt<T>(
  url: string,
  serializedBody: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<PostJsonResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: serializedBody,
    });

    // Parse from text and strip a leading UTF-8 BOM (some feeds emit one).
    const text = (await res.text()).replace(/^﻿/, '');
    const body = (text ? JSON.parse(text) : undefined) as T;
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<PostJsonResponse<T>> {
  const { timeoutMs = 12000, headers = {}, idempotencyKey, retryable } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'GeoResponde-Gateway/1.0',
    ...headers,
  };
  if (idempotencyKey) {
    finalHeaders['Idempotency-Key'] = idempotencyKey;
  }

  const serializedBody = JSON.stringify(body);

  // Retry is only safe when idempotency is honored and not opted out.
  const mayRetry = Boolean(idempotencyKey) && retryable !== false;

  try {
    const result = await attempt<T>(url, serializedBody, finalHeaders, timeoutMs);
    if (mayRetry && RETRYABLE_STATUS.has(result.status)) {
      return await attempt<T>(url, serializedBody, finalHeaders, timeoutMs);
    }
    return result;
  } catch (err) {
    // Network error / timeout (abort). Retry once when idempotency is honored.
    if (mayRetry) {
      return await attempt<T>(url, serializedBody, finalHeaders, timeoutMs);
    }
    throw err;
  }
}
