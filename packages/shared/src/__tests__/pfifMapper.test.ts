import { describe, it, expect } from 'vitest';
import { toPfif14, reportToPfifInput, type PfifMapOptions } from '../pfifMapper.js';
import { pfifToXml } from '../pfif.js';
import type { PersonRecord, Report } from '../types.js';

const NOW = '2026-07-01T00:00:00.000Z';
/** Synthetic — a fake cédula whose digits we scan the XML for. */
const FAKE_CEDULA = '00000123';

const baseOpts: PfifMapOptions = {
  now: NOW,
  authorName: 'GeoResponde',
  sourceName: 'GeoResponde',
  sourceUrl: 'https://georesponde.org/report/abc',
};

const adult: PersonRecord = {
  fullName: 'Ana Prueba',
  cedula: FAKE_CEDULA,
  age: 34,
  gender: 'female',
  status: 'missing',
  lastSeenLocation: 'Plaza Ejemplo',
};

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

describe('toPfif14', () => {
  it('mints namespaced person/note ids under georesponde.org', () => {
    const doc = toPfif14(adult, baseOpts);
    expect(doc.person.person_record_id).toMatch(
      /^georesponde\.org\/[0-9a-f-]{36}$/,
    );
    expect(doc.note?.note_record_id).toMatch(/^georesponde\.org\/[0-9a-f-]{36}$/);
    expect(doc.note?.person_record_id).toBe(doc.person.person_record_id);
  });

  it('sets source_date to now and a MANDATORY expiry_date', () => {
    const doc = toPfif14(adult, baseOpts);
    expect(doc.person.source_date).toBe(NOW);
    expect(doc.person.expiry_date).toBeDefined();
    expect(doc.person.expiry_date).toMatch(/^\d{4}-.*Z$/);
  });

  it('gives adults 30 days and minors 7 days of expiry (minor is shorter)', () => {
    const adultDoc = toPfif14(adult, baseOpts);
    expect(daysBetween(NOW, adultDoc.person.expiry_date)).toBe(30);

    const minorByFlag = toPfif14({ ...adult, isMinor: true }, baseOpts);
    expect(daysBetween(NOW, minorByFlag.person.expiry_date)).toBe(7);

    const minorByAge = toPfif14({ ...adult, age: 12 }, baseOpts);
    expect(daysBetween(NOW, minorByAge.person.expiry_date)).toBe(7);

    expect(daysBetween(NOW, minorByFlag.person.expiry_date)).toBeLessThan(
      daysBetween(NOW, adultDoc.person.expiry_date),
    );
  });

  it('derives full_name from firstName+lastName when fullName is absent', () => {
    const doc = toPfif14(
      { firstName: 'Ana', lastName: 'Prueba', status: 'missing' },
      baseOpts,
    );
    expect(doc.person.full_name).toBe('Ana Prueba');
  });

  it('maps each PersonStatus onto the exact PFIF note enum', () => {
    expect(toPfif14({ ...adult, status: 'missing' }, baseOpts).note?.status).toBe(
      'believed_missing',
    );
    expect(toPfif14({ ...adult, status: 'found' }, baseOpts).note?.status).toBe(
      'believed_alive',
    );
    expect(toPfif14({ ...adult, status: 'safe' }, baseOpts).note?.status).toBe(
      'believed_alive',
    );
    expect(toPfif14({ ...adult, status: 'deceased' }, baseOpts).note?.status).toBe(
      'believed_dead',
    );
    expect(
      toPfif14({ ...adult, status: 'hospitalized' }, baseOpts).note?.status,
    ).toBe('believed_alive');
    expect(
      toPfif14({ ...adult, status: 'unknown' }, baseOpts).note?.status,
    ).toBeUndefined();
  });

  it('appends the hospital to the note text when hospitalized', () => {
    const doc = toPfif14(
      { ...adult, status: 'hospitalized', hospital: 'Hospital Central' },
      baseOpts,
    );
    expect(doc.note?.text).toContain('Hospital Central');
  });

  it('maps sex from Gender and omits it for unknown', () => {
    expect(toPfif14({ ...adult, gender: 'female' }, baseOpts).person.sex).toBe(
      'female',
    );
    expect(toPfif14({ ...adult, gender: 'male' }, baseOpts).person.sex).toBe('male');
    expect(
      toPfif14({ ...adult, gender: 'unknown' }, baseOpts).person.sex,
    ).toBeUndefined();
  });

  it('passes source_name/source_url through from options', () => {
    const doc = toPfif14(adult, baseOpts);
    expect(doc.person.source_name).toBe('GeoResponde');
    expect(doc.person.source_url).toBe('https://georesponde.org/report/abc');
  });

  it('NEVER emits the cédula anywhere in the serialized PFIF XML', () => {
    const doc = toPfif14(adult, baseOpts);
    const xml = pfifToXml(doc);
    expect(xml).not.toContain(FAKE_CEDULA);
    // And it is not on the document object either.
    expect(JSON.stringify(doc)).not.toContain(FAKE_CEDULA);
  });
});

describe('reportToPfifInput', () => {
  const report: Report = {
    id: 'r-1',
    topic: 'missing-person',
    createdAt: NOW,
    fields: {
      fullName: 'Ana Prueba',
      age: 34,
      gender: 'female',
      lastSeenLocation: 'Plaza Ejemplo',
      cedula: FAKE_CEDULA,
      reporterContact: 'tel:+000',
    },
    consent: { targets: [], acknowledgedAt: NOW },
  };

  it('projects a missing-person report onto a PersonRecord WITHOUT the cédula', () => {
    const person = reportToPfifInput(report);
    expect(person.fullName).toBe('Ana Prueba');
    expect(person.age).toBe(34);
    expect(person.lastSeenLocation).toBe('Plaza Ejemplo');
    expect(person.cedula).toBeUndefined();
    expect(JSON.stringify(person)).not.toContain(FAKE_CEDULA);
  });

  it('the cédula never reaches PFIF XML through the report path either', () => {
    const xml = pfifToXml(toPfif14(reportToPfifInput(report), baseOpts));
    expect(xml).not.toContain(FAKE_CEDULA);
  });

  it('throws for a non-missing-person topic', () => {
    expect(() =>
      reportToPfifInput({ ...report, topic: 'resource-need' }),
    ).toThrow(/only maps missing-person/i);
  });
});
