/**
 * Pure `Report` → Ushahidi v5 create-post body mapper (REP-07). No network, no
 * `Date.now`, deterministic for a fixed input. Mirrors the read-side parsers:
 * canonical ↔ native, fixture-tested.
 *
 * Emits the documented v5 body (research 02 §3a, confirmed in ./README.md):
 * `{ form: { id }, title, content, values: { <fieldKey>: [<value>] } }`.
 *
 * SECURITY: fields flagged `sensitive` in REPORT_TOPICS (the cédula) are never
 * placed into `values`, `title`, or (by default) `content` — they must not be
 * pushed into a third-party public intake.
 */

import { REPORT_TOPICS, type Report, type ReportFieldDef } from '@georesponde/shared';

export interface UshahidiPostBody {
  form: { id: number | string };
  title: string;
  content: string;
  values: Record<string, unknown[]>;
}

/** Short human topic label used in title/content. */
const TOPIC_LABEL: Record<Report['topic'], string> = {
  'missing-person': 'Missing person',
  'resource-need': 'Resource need',
  'shelter-status': 'Shelter status',
  'building-damage': 'Damaged building',
};

/** Human labels for content prose; falls back to the raw field name. */
const FIELD_LABEL: Record<string, string> = {
  fullName: 'Name',
  age: 'Age',
  gender: 'Gender',
  lastSeenLocation: 'Last seen',
  reporterContact: 'Contact',
  resourceType: 'Resource',
  location: 'Location',
  description: 'Description',
  urgency: 'Urgency',
  facilityName: 'Facility',
  facilityType: 'Type',
  capacityStatus: 'Capacity',
  needs: 'Needs',
  address: 'Address',
  buildingType: 'Building type',
  damageLevel: 'Damage level',
};

/** The field whose value seeds the title, per topic. */
const PRIMARY_FIELD: Record<Report['topic'], string> = {
  'missing-person': 'lastSeenLocation',
  'resource-need': 'location',
  'shelter-status': 'facilityName',
  'building-damage': 'address',
};

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** Array-wrap a value; coords become `[{ value: { lat, lon } }]`. */
function wrapValue(field: ReportFieldDef, value: unknown): unknown[] {
  if (field.type === 'coords') {
    const c = value as { lat?: number; lon?: number } | [number, number];
    if (Array.isArray(c)) {
      const [lon, lat] = c;
      return [{ value: { lat, lon } }];
    }
    return [{ value: { lat: c.lat, lon: c.lon } }];
  }
  return [value];
}

/**
 * Build the Ushahidi v5 create-post body from a canonical `Report`. `formId`
 * is the target deployment's survey/form id.
 */
export function buildUshahidiPost(
  report: Report,
  formId: number | string,
): UshahidiPostBody {
  const topicDef = REPORT_TOPICS[report.topic];
  const label = TOPIC_LABEL[report.topic];
  const values: Record<string, unknown[]> = {};
  const contentParts: string[] = [`${label} report.`];

  for (const field of topicDef.fields) {
    const raw = report.fields[field.name];
    if (!isPresent(raw)) continue;
    if (field.sensitive) continue; // never emit sensitive PII to a public intake

    values[field.name] = wrapValue(field, raw);

    if (field.type !== 'coords') {
      const human = FIELD_LABEL[field.name] ?? field.name;
      contentParts.push(`${human}: ${String(raw)}.`);
    }
  }

  const primary = report.fields[PRIMARY_FIELD[report.topic]];
  const titleSuffix = isPresent(primary)
    ? String(primary)
    : String(report.fields.fullName ?? report.id);

  return {
    form: { id: formId },
    title: `${label} - ${titleSuffix}`,
    content: contentParts.join(' '),
    values,
  };
}
