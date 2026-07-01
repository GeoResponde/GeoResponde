import { randomUUID, createHash } from 'node:crypto';

/**
 * Idempotency helpers for the submission router (REP-04 / REP-05).
 *
 * - A report-level key is minted per fan-out (`newReportKey`).
 * - Each target receives a per-provider *derived* key (`deriveKey`) so a retry
 *   dedupes upstream without sharing one key across providers.
 * - The audit-lite log records a *salted* hash of the report key (`hashKey`) — a
 *   correlation handle, never the key itself.
 */

/** Mint a fresh report-level idempotency key. */
export function newReportKey(): string {
  return randomUUID();
}

/**
 * Derive a stable, per-provider idempotency key from a report key. Deterministic
 * for the same inputs, distinct per providerId, base64url-encoded, and carries
 * no report content.
 */
export function deriveKey(reportKey: string, providerId: string): string {
  return createHash('sha256').update(`${reportKey}:${providerId}`).digest('base64url');
}

/**
 * Salted sha256 of a report key for audit-lite logging. Deterministic for a
 * given key + salt, differs from the raw key, and changes with the salt. The
 * salt defaults to `GEO_AUDIT_SALT` (env) or a safe built-in default.
 */
export function hashKey(reportKey: string, salt?: string): string {
  const effectiveSalt = salt ?? process.env.GEO_AUDIT_SALT ?? 'georesponde-audit';
  return createHash('sha256').update(`${effectiveSalt}:${reportKey}`).digest('base64url');
}
