import { describe, it, expect } from 'vitest';
import { newReportKey, deriveKey, hashKey } from '../idempotency.js';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe('newReportKey', () => {
  it('returns a distinct UUID each call', () => {
    const a = newReportKey();
    const b = newReportKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('deriveKey', () => {
  it('is deterministic for the same inputs', () => {
    expect(deriveKey('report-1', 'prov-a')).toBe(deriveKey('report-1', 'prov-a'));
  });

  it('differs across providerIds for the same reportKey', () => {
    expect(deriveKey('report-1', 'prov-a')).not.toBe(deriveKey('report-1', 'prov-b'));
  });

  it('produces base64url output (no +, /, or = padding)', () => {
    const key = deriveKey('report-1', 'prov-a');
    expect(key).toMatch(BASE64URL);
    expect(key).not.toContain('+');
    expect(key).not.toContain('/');
    expect(key).not.toContain('=');
  });
});

describe('hashKey', () => {
  it('is deterministic for the same key + salt', () => {
    expect(hashKey('report-1', 'salt')).toBe(hashKey('report-1', 'salt'));
  });

  it('differs from the raw report key (a correlation handle, not the key)', () => {
    expect(hashKey('report-1', 'salt')).not.toBe('report-1');
  });

  it('changes when the salt changes', () => {
    expect(hashKey('report-1', 'salt-a')).not.toBe(hashKey('report-1', 'salt-b'));
  });

  it('produces base64url output', () => {
    expect(hashKey('report-1', 'salt')).toMatch(BASE64URL);
  });
});
