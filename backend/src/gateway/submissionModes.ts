/**
 * Pure SubmissionMode tier builders for no-API providers (REP-08, research 03
 * §2). GeoResponde is a courier, not an author: these build the artifacts the
 * USER acts on — a prefilled deep link, a structured mailto, or copy-to-clipboard
 * manual text — always ending on the provider's OWN domain. Never headless,
 * never scrape-to-write.
 *
 * SECURITY: `buildDeepLink` excludes fields flagged `sensitive` in REPORT_TOPICS
 * (the cédula) — a URL leaks via browser history/referer. Sensitive data goes
 * only into the mailto/manual body (the user's own device / mail client). The
 * constructed URL is never logged server-side (adapters must not log it).
 */

import { REPORT_TOPICS, type Report, type ReportFieldDef } from '@georesponde/shared';

/** Human labels for mailto/manual output; falls back to the raw field name. */
const FIELD_LABEL: Record<string, string> = {
  fullName: 'Nombre',
  age: 'Edad',
  gender: 'Género',
  lastSeenLocation: 'Visto por última vez',
  reporterContact: 'Contacto',
  cedula: 'Cédula (sensible)',
  resourceType: 'Recurso',
  location: 'Ubicación',
  description: 'Descripción',
  urgency: 'Urgencia',
  facilityName: 'Instalación',
  facilityType: 'Tipo',
  capacityStatus: 'Capacidad',
  needs: 'Necesidades',
  address: 'Dirección',
  buildingType: 'Tipo de edificación',
  damageLevel: 'Nivel de daño',
};

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function stringify(value: unknown): string {
  if (value != null && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function presentFields(report: Report): ReportFieldDef[] {
  const def = REPORT_TOPICS[report.topic];
  return def.fields.filter((f) => isPresent(report.fields[f.name]));
}

function shortSummary(report: Report): string {
  const label: Record<Report['topic'], string> = {
    'missing-person': 'Persona desaparecida',
    'resource-need': 'Necesidad de recursos',
    'shelter-status': 'Estado de refugio',
    'building-damage': 'Edificio dañado',
  };
  const primary =
    report.fields.fullName ??
    report.fields.facilityName ??
    report.fields.location ??
    report.fields.address ??
    report.fields.lastSeenLocation;
  return isPresent(primary)
    ? `${label[report.topic]} - ${stringify(primary)}`
    : label[report.topic];
}

/**
 * Prefilled deep link to the provider's public form. Only NON-sensitive present
 * fields become query params; the cédula is never in the URL. Values are
 * URL-encoded. The user submits on the provider's own domain.
 */
export function buildDeepLink(baseUrl: string, report: Report): string {
  const params: string[] = [];
  for (const field of presentFields(report)) {
    if (field.sensitive) continue; // never leak sensitive PII into a URL
    if (field.type === 'coords') continue; // structured, not a query scalar
    const value = encodeURIComponent(stringify(report.fields[field.name]));
    params.push(`${encodeURIComponent(field.name)}=${value}`);
  }
  if (params.length === 0) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${params.join('&')}`;
}

/**
 * `mailto:` URL for the provider's intake address. The subject is a short
 * summary; the body lists ALL present fields (sensitive included, clearly
 * labeled) — the user's own mail client sends it, so the cédula never rides a
 * tracked URL query.
 */
export function buildMailto(intake: string, report: Report): string {
  const subject = shortSummary(report);
  const body = buildManualText(report);
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${intake}?${q}`;
}

/**
 * Clean copy-to-clipboard text: one `Label: value` line per present field,
 * including sensitive fields (the user is copying on their own device).
 */
export function buildManualText(report: Report): string {
  const lines: string[] = [];
  for (const field of presentFields(report)) {
    const label = FIELD_LABEL[field.name] ?? field.name;
    lines.push(`${label}: ${stringify(report.fields[field.name])}`);
  }
  return lines.join('\n');
}
