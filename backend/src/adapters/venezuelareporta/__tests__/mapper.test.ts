import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { Report } from '@georesponde/shared';
import {
  buildVenezuelaReportaSubmission,
  redactSubmissionBody,
} from '../mapper.js';

const load = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8'));

const ORIGEN_ID = 'vr-key-synthetic-0001';

describe('buildVenezuelaReportaSubmission', () => {
  const request = load('submission.request.json') as Report;
  const expected = load('submission.expected.json');

  it('maps a synthetic missing-person Report to the confirmed VR create body', () => {
    const result = buildVenezuelaReportaSubmission(request, ORIGEN_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toEqual(expected);
  });

  it('fixes status to "buscando" and echoes the idempotency key as origen_id', () => {
    const result = buildVenezuelaReportaSubmission(request, ORIGEN_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.status).toBe('buscando');
    expect(result.body.origen_id).toBe(ORIGEN_ID);
  });

  it('maps GENDER (female→femenino, male→masculino) and omits anything else', () => {
    const female = buildVenezuelaReportaSubmission(request);
    expect(female.ok && female.body.genero).toBe('femenino');

    const male = buildVenezuelaReportaSubmission(
      { ...request, fields: { ...request.fields, gender: 'male' } },
      ORIGEN_ID,
    );
    expect(male.ok && male.body.genero).toBe('masculino');

    const other = buildVenezuelaReportaSubmission(
      { ...request, fields: { ...request.fields, gender: 'other' } },
      ORIGEN_ID,
    );
    expect(other.ok && 'genero' in other.body).toBe(false);
  });

  it('fails closed (no body) when nombre is absent — VR requires it', () => {
    const result = buildVenezuelaReportaSubmission(
      { ...request, fields: { ...request.fields, fullName: '' } },
      ORIGEN_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/nombre/);
  });

  it('fails closed (no body) when ciudad (lastSeenLocation) is absent', () => {
    const { lastSeenLocation: _drop, ...fields } = request.fields as Record<string, unknown>;
    const result = buildVenezuelaReportaSubmission({ ...request, fields }, ORIGEN_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/ciudad/);
  });

  it('is deterministic for a fixed input', () => {
    const a = buildVenezuelaReportaSubmission(request, ORIGEN_ID);
    const b = buildVenezuelaReportaSubmission(request, ORIGEN_ID);
    expect(a).toEqual(b);
  });
});

describe('redactSubmissionBody', () => {
  const request = load('submission.request.json') as Report;

  it('drops the cédula from the preview while keeping it in the source body', () => {
    const result = buildVenezuelaReportaSubmission(request, ORIGEN_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The outbound body DOES carry the cédula (VR accepts it under consent).
    expect(result.body.cedula).toBe('00099887');

    const preview = redactSubmissionBody(result.body);
    expect(preview).not.toHaveProperty('cedula');
    expect(JSON.stringify(preview)).not.toContain('00099887');
    // Non-PII fields survive the redaction.
    expect(preview.nombre).toBe('Ana Prueba');
    expect(preview.origen_id).toBe(ORIGEN_ID);
  });
});
