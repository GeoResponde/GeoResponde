import { describe, it, expect } from 'vitest';
import {
  REPORT_TOPICS,
  toReport,
  type Report,
  type SubmissionResult,
  type ReportTopic,
  type SubmissionPackage,
} from '../types.js';

describe('REPORT_TOPICS registry', () => {
  it('has exactly the three v0.5 topics', () => {
    expect(Object.keys(REPORT_TOPICS).sort()).toEqual(
      ['missing-person', 'resource-need', 'shelter-status'].sort(),
    );
  });

  it('missing-person exposes the expected person fields', () => {
    const names = REPORT_TOPICS['missing-person'].fields.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'fullName',
        'age',
        'gender',
        'lastSeenLocation',
        'cedula',
        'reporterContact',
      ]),
    );
  });

  it('flags cedula as sensitive and optional', () => {
    const cedula = REPORT_TOPICS['missing-person'].fields.find((f) => f.name === 'cedula');
    expect(cedula).toBeDefined();
    expect(cedula?.sensitive).toBe(true);
    expect(cedula?.required).toBe(false);
  });

  it('reuses the canonical Gender union for the gender select options', () => {
    const gender = REPORT_TOPICS['missing-person'].fields.find((f) => f.name === 'gender');
    expect(gender?.type).toBe('select');
    expect(gender?.options).toEqual(['male', 'female', 'other', 'unknown']);
  });

  it('shelter-status exposes facility fields with the right select options', () => {
    const fields = REPORT_TOPICS['shelter-status'].fields;
    const names = fields.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'facilityName',
        'facilityType',
        'location',
        'capacityStatus',
        'needs',
        'reporterContact',
      ]),
    );
    const facilityType = fields.find((f) => f.name === 'facilityType');
    expect(facilityType?.type).toBe('select');
    expect(facilityType?.options).toEqual(['shelter', 'hospital']);
    const capacityStatus = fields.find((f) => f.name === 'capacityStatus');
    expect(capacityStatus?.options).toEqual(['open', 'full', 'closed', 'unknown']);
  });

  it('resource-need exposes the generic resource fields', () => {
    const names = REPORT_TOPICS['resource-need'].fields.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining(['resourceType', 'location', 'description', 'urgency']),
    );
  });
});

describe('toReport (legacy SubmissionPackage -> Report)', () => {
  it('maps type, payload and timestamp onto a Report and mints an id', () => {
    const pkg: SubmissionPackage = {
      type: 'resource-need',
      payload: { resourceType: 'water', location: 'Caracas' },
      timestamp: '2026-07-01T00:00:00.000Z',
    };
    const report: Report = toReport(pkg);
    expect(report.topic).toBe('resource-need');
    expect(report.fields).toEqual(pkg.payload);
    expect(report.createdAt).toBe(pkg.timestamp);
    expect(typeof report.id).toBe('string');
    expect(report.id.length).toBeGreaterThan(0);
    expect(report.consent).toBeDefined();
  });

  it('falls back to a default topic when the legacy type is unknown', () => {
    const pkg: SubmissionPackage = {
      type: 'something-legacy',
      payload: {},
      timestamp: '2026-07-01T00:00:00.000Z',
    };
    const report = toReport(pkg);
    expect(Object.keys(REPORT_TOPICS)).toContain(report.topic);
  });
});

describe('SubmissionResult shape', () => {
  it('accepts a dry-run skipped result', () => {
    const result: SubmissionResult = { provider: 'dry-run', mode: 'dry-run', status: 'skipped' };
    expect(result.mode).toBe('dry-run');
    expect(result.status).toBe('skipped');
  });
});

// Type-level guard: ReportTopic must stay the three-topic union.
const _topics: ReportTopic[] = ['missing-person', 'resource-need', 'shelter-status'];
void _topics;
