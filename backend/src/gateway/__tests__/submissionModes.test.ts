import { describe, it, expect } from 'vitest';
import type { Report } from '@georesponde/shared';
import {
  buildDeepLink,
  buildMailto,
  buildManualText,
} from '../submissionModes.js';

const FAKE_CEDULA = '00000123';

const report: Report = {
  id: 'rep-synthetic-0002',
  topic: 'missing-person',
  createdAt: '2026-07-01T00:00:00.000Z',
  fields: {
    fullName: 'Ana Prueba',
    age: 34,
    gender: 'female',
    lastSeenLocation: 'Plaza Ejemplo',
    cedula: FAKE_CEDULA,
    reporterContact: 'tel:+000',
  },
  consent: { targets: [], acknowledgedAt: '2026-07-01T00:00:00.000Z' },
};

const BASE_URL = 'https://desaparecidosterremotovenezuela.com/reportar';

describe('buildDeepLink', () => {
  const url = buildDeepLink(BASE_URL, report);

  it('includes non-sensitive fields as encoded query params', () => {
    expect(url.startsWith(BASE_URL)).toBe(true);
    expect(url).toContain('fullName=Ana%20Prueba');
    expect(url).toContain('lastSeenLocation=Plaza%20Ejemplo');
  });

  it('NEVER includes the sensitive cédula in the URL', () => {
    expect(url).not.toContain(FAKE_CEDULA);
    expect(url).not.toContain('cedula');
  });

  it('NEVER includes the sensitive reporterContact in the URL', () => {
    expect(url).not.toContain('reporterContact');
    expect(url).not.toContain('tel%3A%2B000');
    expect(url).not.toContain('tel:+000');
  });

  it('is a pure string with no side effects', () => {
    expect(typeof url).toBe('string');
    expect(buildDeepLink(BASE_URL, report)).toBe(url);
  });
});

describe('buildMailto', () => {
  const mailto = buildMailto('intake@example.test', report);

  it('is a mailto: URL with an encoded subject and body', () => {
    expect(mailto.startsWith('mailto:intake@example.test?')).toBe(true);
    expect(mailto).toContain('subject=');
    expect(mailto).toContain('body=');
  });

  it('DOES carry the cédula in the mail body (not a tracked URL query)', () => {
    // The cédula is URL-encoded inside the body param, so decode to assert.
    const decoded = decodeURIComponent(mailto);
    expect(decoded).toContain(FAKE_CEDULA);
    // It is inside the body, never in the deep-link query surface.
    expect(buildDeepLink(BASE_URL, report)).not.toContain(FAKE_CEDULA);
  });
});

describe('buildManualText', () => {
  const text = buildManualText(report);

  it('lists every present field as a label: value line, including the cédula', () => {
    expect(text).toContain('Ana Prueba');
    expect(text).toContain('Plaza Ejemplo');
    expect(text).toContain(FAKE_CEDULA);
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  it('is a pure string', () => {
    expect(typeof text).toBe('string');
    expect(buildManualText(report)).toBe(text);
  });
});
