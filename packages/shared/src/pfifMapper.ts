/**
 * PersonRecord/Report → PFIF 1.4 mapper. Pure, network-free. This is where the
 * PFIF policy lives (research 01): namespaced ids, mandatory `expiry_date`
 * (shorter for minors), status→note-enum mapping, and — critically — the cédula
 * is NEVER read into any PFIF field (research 01 §4.4; PFIF has no cédula slot,
 * and we refuse to invent one that leaks PII into a federated feed).
 *
 * The write-side mapper mirrors the read-side `parser.ts` files: canonical ↔
 * native, fixture-tested, zero IO.
 */

import {
  type PfifDocument,
  type PfifNote,
  type PfifNoteStatus,
  type PfifPerson,
} from './pfif.js';
import type { Gender, PersonRecord, PersonStatus, Report } from './types.js';

const MS_PER_DAY = 86_400_000;

/** Options controlling minting + expiry policy for {@link toPfif14}. */
export interface PfifMapOptions {
  /** ISO 8601 UTC "now" — becomes `source_date` and the expiry anchor. */
  now: string;
  /** Provenance namespace for record ids. Defaults to `georesponde.org`. */
  domain?: string;
  /** Note `author_name`. Defaults to `GeoResponde`. */
  authorName?: string;
  /** Person `source_name`. */
  sourceName?: string;
  /** Person `source_url` (link back to the report/upstream). */
  sourceUrl?: string;
  /** Expiry window for adults, in days. Defaults to 30. */
  expiryDaysAdult?: number;
  /** Expiry window for minors, in days. Defaults to 7 (shorter). */
  expiryDaysMinor?: number;
}

/** PersonStatus → exact PFIF note status enum (research 01 §3 mapping table). */
const STATUS_TO_PFIF: Record<PersonStatus, PfifNoteStatus | undefined> = {
  missing: 'believed_missing',
  found: 'believed_alive',
  safe: 'believed_alive',
  deceased: 'believed_dead',
  hospitalized: 'believed_alive',
  unknown: undefined,
};

/** Gender → PFIF `sex`; `unknown` is omitted (no wire value). */
function toSex(gender: Gender | undefined): string | undefined {
  if (gender === 'male' || gender === 'female' || gender === 'other') return gender;
  return undefined;
}

function randomUuid(): string {
  const g = globalThis.crypto;
  if (g && typeof g.randomUUID === 'function') return g.randomUUID();
  // Deterministic-enough fallback for non-crypto runtimes (tests use crypto).
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function mintId(domain: string): string {
  return `${domain}/${randomUuid()}`;
}

function addDaysIso(anchor: string, days: number): string {
  return new Date(new Date(anchor).getTime() + days * MS_PER_DAY).toISOString();
}

function isMinorPerson(person: PersonRecord): boolean {
  if (person.isMinor === true) return true;
  return person.age != null && person.age < 18;
}

function resolveFullName(person: PersonRecord): string {
  if (person.fullName && person.fullName.trim()) return person.fullName.trim();
  const joined = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return joined || 'Unknown';
}

/**
 * Build a {@link PfifDocument} from a {@link PersonRecord}. The person always
 * carries a namespaced id, `source_date`, `full_name`, and a MANDATORY
 * `expiry_date` (30d adults / 7d minors). A note carries the mapped status
 * (omitted when `unknown`). The cédula is never read — it cannot reach PFIF.
 */
export function toPfif14(person: PersonRecord, opts: PfifMapOptions): PfifDocument {
  const domain = opts.domain ?? 'georesponde.org';
  const now = opts.now;
  const days = isMinorPerson(person)
    ? opts.expiryDaysMinor ?? 7
    : opts.expiryDaysAdult ?? 30;

  const personRecordId = mintId(domain);

  const pfifPerson: PfifPerson = {
    person_record_id: personRecordId,
    source_date: now,
    full_name: resolveFullName(person),
    expiry_date: addDaysIso(now, days),
    given_name: person.firstName || undefined,
    family_name: person.lastName || undefined,
    sex: toSex(person.gender),
    age: person.age != null ? String(person.age) : undefined,
    home_city: person.lastSeenLocation || undefined,
    source_name: opts.sourceName || person.sourceName || undefined,
    source_url: opts.sourceUrl || undefined,
    photo_url: person.photoUrl || undefined,
  };

  const status = person.status ? STATUS_TO_PFIF[person.status] : undefined;

  const textParts: string[] = [];
  if (person.description) textParts.push(person.description);
  if (person.status === 'hospitalized' && person.hospital) {
    textParts.push(`Hospital: ${person.hospital}`);
  }

  const note: PfifNote = {
    note_record_id: mintId(domain),
    person_record_id: personRecordId,
    author_name: opts.authorName || 'GeoResponde',
    source_date: now,
    status,
    last_known_location: person.lastSeenLocation || undefined,
    text: textParts.length ? textParts.join(' — ') : undefined,
  };

  return { person: pfifPerson, note };
}

/**
 * Project a missing-person {@link Report} onto a {@link PersonRecord} that
 * {@link toPfif14} consumes. The cédula is deliberately LEFT OUT of the
 * projection so it can never reach a PFIF field. Throws for non-person topics
 * (only persons become PFIF).
 */
export function reportToPfifInput(report: Report): PersonRecord {
  if (report.topic !== 'missing-person') {
    throw new Error('PFIF only maps missing-person reports');
  }
  const f = report.fields;
  const asString = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v : undefined;
  const asNumber = (v: unknown): number | undefined =>
    typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : undefined;

  const ageValue = asNumber(f.age);

  // NOTE: `cedula` is intentionally NOT projected. It is sensitive PII and must
  // never reach PFIF (research 01 §4.4).
  return {
    fullName: asString(f.fullName),
    age: Number.isFinite(ageValue) ? ageValue : undefined,
    gender: (asString(f.gender) as Gender | undefined) ?? undefined,
    lastSeenLocation: asString(f.lastSeenLocation),
    status: 'missing',
  };
}
