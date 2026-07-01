/**
 * PFIF 1.4 (People Finder Interchange Format) typed model + a pure XML
 * serializer. This module is a DUMB serializer: it turns a already-decided
 * {@link PfifDocument} into a `<pfif:pfif>` XML string and does no field
 * selection or PII policy. All mapping decisions (mandatory `expiry_date`,
 * status→note, dropping the cédula) live in `pfifMapper.ts`.
 *
 * Reference: research 01 (PFIF person/note record fields, namespaced ids,
 * mandatory expiry, GMT/4-digit-year timestamps). Namespace is the canonical
 * PFIF 1.4 URI `http://zesty.ca/pfif/1.4`.
 */

/**
 * The exact PFIF note `status` enum. No other value is valid on the wire; the
 * mapper omits the field entirely rather than emit an out-of-enum status.
 */
export type PfifNoteStatus =
  | 'information_sought'
  | 'is_note_author'
  | 'believed_alive'
  | 'believed_missing'
  | 'believed_dead';

/** A PFIF 1.4 person record. snake_case field names match the spec verbatim. */
export interface PfifPerson {
  /** `domain_name/unique_string` — minted under `georesponde.org/<uuid>`. */
  person_record_id: string;
  /** ISO 8601 UTC (`...Z`), 4-digit year. */
  source_date: string;
  full_name: string;
  /** MANDATORY (owner directive): the downstream repo MUST delete after this. */
  expiry_date: string;
  given_name?: string;
  family_name?: string;
  sex?: string;
  age?: string;
  home_city?: string;
  source_name?: string;
  source_url?: string;
  photo_url?: string;
}

/** A PFIF 1.4 note record, nested under its person. */
export interface PfifNote {
  note_record_id: string;
  person_record_id: string;
  author_name: string;
  source_date: string;
  status?: PfifNoteStatus;
  last_known_location?: string;
  text?: string;
}

/** A single PFIF document: one person and (optionally) one note. */
export interface PfifDocument {
  person: PfifPerson;
  note?: PfifNote;
}

const PFIF_NS = 'http://zesty.ca/pfif/1.4';

/** Escape the five XML-significant characters in a text value. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Emit a `<pfif:field>value</pfif:field>` line when `value` is present, or an
 * empty string when it is `undefined`/`null` (absent fields are omitted).
 */
function field(name: string, value: string | undefined, indent: string): string {
  if (value === undefined || value === null) return '';
  return `${indent}<pfif:${name}>${escapeXml(String(value))}</pfif:${name}>\n`;
}

function serializeNote(note: PfifNote): string {
  const i = '      ';
  let out = '    <pfif:note>\n';
  out += field('note_record_id', note.note_record_id, i);
  out += field('person_record_id', note.person_record_id, i);
  out += field('author_name', note.author_name, i);
  out += field('source_date', note.source_date, i);
  out += field('status', note.status, i);
  out += field('last_known_location', note.last_known_location, i);
  out += field('text', note.text, i);
  out += '    </pfif:note>\n';
  return out;
}

/**
 * Serialize a {@link PfifDocument} into a single-root PFIF 1.4 XML string. The
 * note (when present) is nested inside its `<pfif:person>`. Values are
 * XML-escaped; timestamps and ids pass through verbatim.
 */
export function pfifToXml(doc: PfifDocument): string {
  const p = doc.person;
  const i = '      ';
  let person = '    <pfif:person>\n';
  person += field('person_record_id', p.person_record_id, i);
  person += field('source_date', p.source_date, i);
  person += field('expiry_date', p.expiry_date, i);
  person += field('full_name', p.full_name, i);
  person += field('given_name', p.given_name, i);
  person += field('family_name', p.family_name, i);
  person += field('sex', p.sex, i);
  person += field('age', p.age, i);
  person += field('home_city', p.home_city, i);
  person += field('source_name', p.source_name, i);
  person += field('source_url', p.source_url, i);
  person += field('photo_url', p.photo_url, i);
  if (doc.note) person += serializeNote(doc.note);
  person += '    </pfif:person>\n';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<pfif:pfif xmlns:pfif="${PFIF_NS}">\n${person}</pfif:pfif>\n`;
}
