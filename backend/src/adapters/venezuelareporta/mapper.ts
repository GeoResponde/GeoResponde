/**
 * Pure `Report(missing-person)` → Venezuela Reporta create-persona body mapper.
 * No network, no `Date.now`, deterministic for a fixed input — mirrors the
 * read-side parser (native ↔ canonical) and is fixture-tested.
 *
 * Unlike the Ushahidi public intake, Venezuela Reporta IS a person registry that
 * accepts a cédula under user consent, so the cédula IS placed into the outbound
 * body. It is nonetheless PII: {@link redactSubmissionBody} strips it for any
 * preview, log, or HTTP response envelope. The cédula only ever leaves this
 * process inside a live POST to Venezuela Reporta itself.
 */

import type { Gender, Report } from '@georesponde/shared';

/**
 * The `POST /api/v1/personas` request body Venezuela Reporta accepts. Only the
 * fields we emit are typed. `status` is fixed to `'buscando'`: VR rejects a
 * `fallecido` create, and GeoResponde only forwards active searches here.
 */
export interface VenezuelaReportaSubmitBody {
  status: 'buscando';
  nombre: string;
  ciudad: string;
  /** Per-provider idempotency key, so a resubmit UPDATEs instead of duplicating. */
  origen_id?: string;
  /** National ID. PII — sent to VR, never previewed/logged (see redactSubmissionBody). */
  cedula?: string;
  genero?: 'femenino' | 'masculino';
  edad?: number;
  ultima_vez?: string;
}

/**
 * Outcome of the mapping. `ok:false` carries a PII-free `reason` so the adapter
 * can return `status:'error'` WITHOUT attempting a POST (VR requires nombre and
 * ciudad; an incomplete report must never reach the network).
 */
export type VenezuelaReportaMapResult =
  | { ok: true; body: VenezuelaReportaSubmitBody }
  | { ok: false; reason: string };

/** Canonical Gender → VR `genero`. Anything else is omitted (VR only takes these two). */
const GENERO: Partial<Record<Gender, 'femenino' | 'masculino'>> = {
  female: 'femenino',
  male: 'masculino',
};

/** True when a value is a non-empty, non-whitespace string. */
function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build the Venezuela Reporta create-persona body from a canonical `Report`.
 * `origenId` is the per-provider idempotency key echoed as `origen_id`.
 *
 * Fails closed (`ok:false`) when a VR-required field is absent, so the caller
 * never POSTs an incomplete registry entry:
 *  - `nombre`  ← fields.fullName          (required)
 *  - `ciudad`  ← fields.lastSeenLocation  (required by VR)
 */
export function buildVenezuelaReportaSubmission(
  report: Report,
  origenId?: string,
): VenezuelaReportaMapResult {
  const fields = report.fields ?? {};

  const nombre = fields.fullName;
  if (!nonEmptyString(nombre)) {
    return { ok: false, reason: 'missing required field: nombre (fullName)' };
  }

  const ciudad = fields.lastSeenLocation;
  if (!nonEmptyString(ciudad)) {
    return { ok: false, reason: 'missing required field: ciudad (lastSeenLocation)' };
  }

  const body: VenezuelaReportaSubmitBody = {
    status: 'buscando',
    nombre: nombre.trim(),
    ciudad: ciudad.trim(),
    // ultima_vez mirrors the last-seen location, as VR expects a free-text hint.
    ultima_vez: ciudad.trim(),
  };

  if (origenId) body.origen_id = origenId;

  if (nonEmptyString(fields.cedula)) {
    body.cedula = fields.cedula.trim();
  }

  const genero = GENERO[fields.gender as Gender];
  if (genero) body.genero = genero;

  const age = typeof fields.age === 'number' ? fields.age : Number(fields.age);
  if (Number.isFinite(age)) body.edad = age;

  return { ok: true, body };
}

/**
 * Return a PII-free copy of a submission body: the `cedula` is dropped. Use this
 * for the dry-run preview, any log line, and anything returned in the HTTP
 * response envelope. The full body (with cédula) is only handed to the live POST.
 */
export function redactSubmissionBody(
  body: VenezuelaReportaSubmitBody,
): Omit<VenezuelaReportaSubmitBody, 'cedula'> {
  const { cedula: _cedula, ...safe } = body;
  return safe;
}
