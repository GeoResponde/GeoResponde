import { describe, it, expect } from 'vitest';
import { pfifToXml, type PfifDocument } from '../pfif.js';

/**
 * Hand-built synthetic PFIF document (no PersonRecord involvement yet). Proves
 * the dumb serializer: single pfif:pfif root, nested note, XML escaping, and
 * that timestamps/ids pass through verbatim.
 */
const doc: PfifDocument = {
  person: {
    person_record_id: 'georesponde.org/11111111-1111-1111-1111-111111111111',
    source_date: '2026-07-01T00:00:00.000Z',
    full_name: 'Ana <Prueba> & "Test"',
    expiry_date: '2026-07-31T00:00:00.000Z',
    given_name: 'Ana',
    family_name: 'Prueba',
    sex: 'female',
    age: '34',
    home_city: 'Caracas',
    source_name: 'GeoResponde',
    source_url: 'https://georesponde.org/report/abc',
    photo_url: 'https://example.test/p.jpg',
  },
  note: {
    note_record_id: 'georesponde.org/22222222-2222-2222-2222-222222222222',
    person_record_id: 'georesponde.org/11111111-1111-1111-1111-111111111111',
    author_name: 'GeoResponde',
    source_date: '2026-07-01T00:00:00.000Z',
    status: 'believed_missing',
    last_known_location: 'Plaza Ejemplo',
    text: 'Vista por última vez con chaqueta azul',
  },
};

describe('pfifToXml', () => {
  const xml = pfifToXml(doc);

  it('emits a single pfif:pfif root with the 1.4 namespace', () => {
    expect(xml).toContain('<pfif:pfif xmlns:pfif="http://zesty.ca/pfif/1.4">');
    expect(xml.trim().endsWith('</pfif:pfif>')).toBe(true);
    // Exactly one root.
    expect(xml.match(/<pfif:pfif\b/g)).toHaveLength(1);
  });

  it('nests the note inside the person element', () => {
    const personOpen = xml.indexOf('<pfif:person>');
    const personClose = xml.indexOf('</pfif:person>');
    const noteOpen = xml.indexOf('<pfif:note>');
    const noteClose = xml.indexOf('</pfif:note>');
    expect(personOpen).toBeGreaterThanOrEqual(0);
    expect(noteOpen).toBeGreaterThan(personOpen);
    expect(noteClose).toBeLessThan(personClose);
  });

  it('round-trips the namespaced person_record_id verbatim', () => {
    expect(xml).toContain(
      '<pfif:person_record_id>georesponde.org/11111111-1111-1111-1111-111111111111</pfif:person_record_id>',
    );
  });

  it('emits the mandatory expiry_date and source_date verbatim (ISO Z, 4-digit year)', () => {
    expect(xml).toContain('<pfif:expiry_date>2026-07-31T00:00:00.000Z</pfif:expiry_date>');
    expect(xml).toContain('<pfif:source_date>2026-07-01T00:00:00.000Z</pfif:source_date>');
    expect(/<pfif:expiry_date>\d{4}-/.test(xml)).toBe(true);
  });

  it('XML-escapes special characters in values', () => {
    expect(xml).toContain('Ana &lt;Prueba&gt; &amp; &quot;Test&quot;');
    expect(xml).not.toContain('Ana <Prueba>');
  });

  it('omits absent optional fields', () => {
    const minimal = pfifToXml({
      person: {
        person_record_id: 'georesponde.org/x',
        source_date: '2026-07-01T00:00:00.000Z',
        full_name: 'Solo Nombre',
        expiry_date: '2026-07-31T00:00:00.000Z',
      },
    });
    expect(minimal).not.toContain('<pfif:given_name>');
    expect(minimal).not.toContain('<pfif:note>');
    expect(minimal).toContain('<pfif:full_name>Solo Nombre</pfif:full_name>');
  });
});
