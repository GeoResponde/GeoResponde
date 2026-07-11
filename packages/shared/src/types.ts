export type LayerCategory = 'Scientific' | 'Infrastructure' | 'Humanitarian' | 'Logistics' | 'Community' | 'Earthquakes' | 'Geology' | 'Satellite' | 'Hazards';

export interface HumanitarianProvider {
  id: string;
  display_name: string;
  website: string;
  description: string;
  logo: string;
  /**
   * `reference` marks a non-humanitarian, SDK-demonstration provider (e.g.
   * `example-reference`) that exists to show how to wire up the adapter SDK.
   * It is never a real data source and should be excluded from any
   * production-facing provider listing.
   */
  status: 'active' | 'inactive' | 'degraded' | 'reference';
  adapter: string;
  capabilities: string[];
}

/**
 * Canonical status for a person across providers. Each provider maps its own
 * vocabulary (desaparecido, buscando, believed_alive, admitted, ...) onto this.
 */
export type PersonStatus =
  | 'missing'
  | 'found'
  | 'hospitalized'
  | 'safe'
  | 'deceased'
  | 'unknown';

/**
 * Canonical gender option values. Single source of truth for the `Gender`
 * union so forms (see REPORT_TOPICS) never redeclare a parallel list.
 */
export const GENDER_VALUES = ['male', 'female', 'other', 'unknown'] as const;

export type Gender = (typeof GENDER_VALUES)[number];

/**
 * Allowed values for the `building-damage` topic's structured selects. Kept as
 * shared constants so the form options and any downstream mapping stay in sync.
 */
export const BUILDING_TYPE_VALUES = [
  'residential',
  'commercial',
  'public',
  'mixed',
  'other',
] as const;

export type BuildingType = (typeof BUILDING_TYPE_VALUES)[number];

export const DAMAGE_LEVEL_VALUES = ['minor', 'moderate', 'severe', 'destroyed'] as const;

export type DamageLevel = (typeof DAMAGE_LEVEL_VALUES)[number];

export interface PersonContact {
  name?: string;
  phone?: string;
  email?: string;
}

/**
 * Structured, provider-agnostic view of a person result. Populated by adapters
 * when the upstream source exposes the data, so the UI can render richer cards
 * (ID number, age, status badge, ...) instead of only a title and subtitle.
 * Every field is optional: providers fill in what they actually expose.
 */
export interface PersonRecord {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  /** National ID (cédula). May be partial/masked as returned by the source. */
  cedula?: string;
  age?: number;
  gender?: Gender;
  /** Canonical status. */
  status?: PersonStatus;
  /** The provider's original, untranslated status label. */
  rawStatus?: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  hospital?: string;
  description?: string;
  photoUrl?: string;
  contact?: PersonContact;
  isMinor?: boolean;
  verified?: boolean;
  /** Upstream source/origin label, when the provider aggregates others. */
  sourceName?: string;
}

export interface NormalizedSearchResult {
  provider: string;
  provider_id: string;
  type: string; // 'person', 'building', 'shelter', etc.
  title: string;
  subtitle?: string;
  status?: string;
  location?: [number, number]; // [lng, lat]
  last_update?: string;
  confidence?: number;
  url: string;
  thumbnail?: string;
  /** Structured person fields when `type === 'person'`. */
  person?: PersonRecord;
  /**
   * When the same entity was reported by several providers and merged, the
   * other providers that also reported it (for provenance / "also reported by").
   * The primary provider stays in `provider`.
   */
  sources?: Array<{ provider: string; url: string }>;
  metadata?: Record<string, any>;
}

/**
 * @deprecated Use `Report`. Kept as an alias so existing imports keep compiling
 * while the codebase migrates to the structured `Report` vocabulary. Convert a
 * legacy package into a `Report` with {@link toReport}.
 */
export interface SubmissionPackage {
  providerId?: string;
  type: string;
  payload: Record<string, any>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Report vocabulary (v0.5) — the canonical report-composition types shared by
// the frontend form, the gateway route, and (from Phase 10) the submission
// router. Provider-agnostic on purpose so PFIF/Ushahidi mappers slot in later.
// ---------------------------------------------------------------------------

/**
 * The report topics GeoResponde composes in v0.5. Extensible by design: add a
 * key here plus an entry in {@link REPORT_TOPICS} and the whole form follows.
 */
export type ReportTopic =
  | 'missing-person'
  | 'resource-need'
  | 'shelter-status'
  | 'building-damage';

/** Declarative description of one field in a report form. */
export interface ReportFieldDef {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'coords';
  required: boolean;
  /** PII that must never be logged/serialized in transit (e.g. cédula). */
  sensitive?: boolean;
  /** Allowed values for `type: 'select'`. */
  options?: readonly string[];
}

/** A topic paired with the fields its report collects. */
export interface ReportTopicDef {
  topic: ReportTopic;
  fields: readonly ReportFieldDef[];
}

/**
 * Field registry driving the report form. The single source of truth for what
 * each topic collects — the UI renders straight from this, so topics stay
 * extensible without hardcoding a form per topic.
 */
export const REPORT_TOPICS: Record<ReportTopic, ReportTopicDef> = {
  'missing-person': {
    topic: 'missing-person',
    fields: [
      { name: 'fullName', type: 'text', required: true },
      { name: 'age', type: 'number', required: false },
      { name: 'gender', type: 'select', required: false, options: GENDER_VALUES },
      { name: 'lastSeenLocation', type: 'text', required: false },
      { name: 'lastSeenCoords', type: 'coords', required: false },
      { name: 'cedula', type: 'text', required: false, sensitive: true },
      { name: 'reporterContact', type: 'text', required: false, sensitive: true },
    ],
  },
  'resource-need': {
    topic: 'resource-need',
    fields: [
      { name: 'resourceType', type: 'text', required: true },
      { name: 'location', type: 'text', required: true },
      { name: 'description', type: 'textarea', required: false },
      { name: 'urgency', type: 'select', required: false, options: ['low', 'medium', 'high', 'critical'] },
    ],
  },
  'shelter-status': {
    topic: 'shelter-status',
    fields: [
      { name: 'facilityName', type: 'text', required: true },
      { name: 'facilityType', type: 'select', required: true, options: ['shelter', 'hospital'] },
      { name: 'location', type: 'text', required: true },
      { name: 'locationCoords', type: 'coords', required: false },
      { name: 'capacityStatus', type: 'select', required: false, options: ['open', 'full', 'closed', 'unknown'] },
      { name: 'needs', type: 'textarea', required: false },
      { name: 'reporterContact', type: 'text', required: false, sensitive: true },
    ],
  },
  'building-damage': {
    topic: 'building-damage',
    fields: [
      { name: 'address', type: 'text', required: true },
      { name: 'locationCoords', type: 'coords', required: false },
      { name: 'buildingType', type: 'select', required: false, options: BUILDING_TYPE_VALUES },
      { name: 'damageLevel', type: 'select', required: true, options: DAMAGE_LEVEL_VALUES },
      { name: 'description', type: 'textarea', required: false },
      { name: 'reporterContact', type: 'text', required: false, sensitive: true },
    ],
  },
};

/**
 * Why a required field failed validation. `missing` = empty/absent;
 * `invalid` = present but malformed for its type (bad number, coords, or a
 * select value outside its options).
 */
export type ReportFieldError = 'missing' | 'invalid';

/** Result of validating a report's fields against its topic definition. */
export interface ReportValidation {
  ok: boolean;
  /** Field name → why it failed. Empty when `ok` is true. */
  errors: Record<string, ReportFieldError>;
}

/** True when a value is absent or an empty/whitespace-only string. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/**
 * Validate a report's fields against its topic definition — the single source
 * of truth shared by the form (disable submit, show errors) and the gateway
 * route (reject with 400). Required fields must be non-empty; any provided
 * value must be well-formed for its declared type. Unknown topics fail closed.
 */
export function validateReport(
  topic: string,
  fields: Record<string, unknown> | undefined,
): ReportValidation {
  const errors: Record<string, ReportFieldError> = {};
  const def = (REPORT_TOPICS as Record<string, ReportTopicDef>)[topic];
  if (!def) return { ok: false, errors };

  const data = fields ?? {};
  for (const field of def.fields) {
    const value = data[field.name];
    const empty = isEmpty(value);

    if (field.required && empty) {
      errors[field.name] = 'missing';
      continue;
    }
    if (empty) continue; // optional + empty → fine

    switch (field.type) {
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n)) errors[field.name] = 'invalid';
        break;
      }
      case 'select': {
        if (!field.options || !field.options.includes(value as string)) {
          errors[field.name] = 'invalid';
        }
        break;
      }
      case 'coords': {
        // Accept a [lng, lat] tuple of finite numbers in range.
        const ok =
          Array.isArray(value) &&
          value.length === 2 &&
          value.every((c) => Number.isFinite(c)) &&
          Math.abs(value[0]) <= 180 &&
          Math.abs(value[1]) <= 90;
        if (!ok) errors[field.name] = 'invalid';
        break;
      }
      default:
        break; // text/textarea: non-empty already satisfied
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * A structured, provider-agnostic report the user composes. GeoResponde is a
 * federator, not a system of record: this crosses to the gateway, gets
 * forwarded, and only a receipt is kept — the body is never persisted here.
 */
export interface Report {
  id: string;
  topic: ReportTopic;
  createdAt: string;
  fields: Record<string, unknown>;
  consent: {
    /** Provider/target ids the user consented to forward to (filled in Phase 10). */
    targets: string[];
    /** ISO timestamp the consent checkbox was acknowledged. */
    acknowledgedAt: string;
  };
  reporter?: {
    contact?: string;
  };
}

/**
 * How a provider accepts a submission. Declared now for Phase 11 (the deep-link/
 * mailto/manual tiers); Phase 10's router only exercises the `api`/dry-run path.
 */
export type SubmissionMode = 'api' | 'deep_link' | 'mailto' | 'manual';

/**
 * Per-target outcome of a submission. Deliberately provider-agnostic so the
 * router (Phase 10) and Phase 11's PFIF/Ushahidi adapters slot in without
 * reshaping. Extended additively in Phase 10: every new member is optional, so a
 * Phase-9-shaped result object still satisfies the type.
 */
export interface SubmissionResult {
  provider: string;
  mode: 'dry-run' | 'live';
  status: 'ok' | 'error' | 'skipped';
  receipt?: {
    remoteId?: string;
    url?: string;
    /** ISO timestamp of the receipt, completing the REP-05 receipt shape. */
    timestamp?: string;
  };
  preview?: unknown;
  error?: string;
  /** Per-provider derived idempotency key, echoed back so the client can dedupe. */
  idempotencyKey?: string;
  /** ISO timestamp stamped by the gateway when a live send is attempted. */
  submittedAt?: string;
  /** Whether this outcome is safe to retry (surfaced by retry-aware adapters). */
  retryable?: boolean;
  /**
   * Handoff for no-API providers (REP-08). When a provider has no submission
   * API, GeoResponde acts as a courier, not an author: it returns the tier the
   * user should use to submit on the provider's OWN domain. `actionUrl` is the
   * prefilled deep-link or `mailto:` URL; `body` is the copy-to-clipboard manual
   * text. Additive + optional: every prior `SubmissionResult` still type-checks.
   */
  action?: {
    tier: SubmissionMode;
    actionUrl?: string;
    body?: string;
  };
}

/**
 * The roll-up the submission router returns — NEVER stored. Summarizes one
 * `Report` fanned out across N submission-capable providers over the Phase-9
 * `status` vocabulary (`ok`/`skipped`/`error`).
 */
export interface SubmissionReport {
  /** Report-level idempotency key minted for this fan-out. */
  idempotencyKey: string;
  topic: ReportTopic;
  results: SubmissionResult[];
  summary: { ok: number; skipped: number; error: number };
  elapsedMs: number;
}

/**
 * Tally a set of per-provider results by `status`. An empty array yields all
 * zeros. Single source of truth for the `SubmissionReport.summary` roll-up.
 */
export function summarize(results: SubmissionResult[]): {
  ok: number;
  skipped: number;
  error: number;
} {
  const summary = { ok: 0, skipped: 0, error: 0 };
  for (const r of results) summary[r.status] += 1;
  return summary;
}

/**
 * Convert a legacy {@link SubmissionPackage} into a {@link Report}. Preserves
 * `payload` as the report fields and `timestamp` as `createdAt`, mints an id,
 * and maps `type` onto a known topic (falling back to `resource-need`, the
 * generic case, when the legacy type is not a registered topic).
 */
export function toReport(pkg: SubmissionPackage): Report {
  const topic: ReportTopic = (Object.keys(REPORT_TOPICS) as ReportTopic[]).includes(
    pkg.type as ReportTopic,
  )
    ? (pkg.type as ReportTopic)
    : 'resource-need';
  return {
    id:
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    topic,
    createdAt: pkg.timestamp,
    fields: { ...pkg.payload },
    consent: { targets: [], acknowledgedAt: pkg.timestamp },
  };
}

/**
 * ---------------------------------------------------------------------------
 * Situation map contracts (Phase 12, EON-01)
 * ---------------------------------------------------------------------------
 * Normalized, Phase-13-facing shape for a natural-disaster event sourced from
 * NASA EONET v3. The backend collapses each EONET event (which carries a
 * time-series geometry array) into a single representative GeoJSON Point and
 * pre-sorts the collection by first-appearance date, so the MapLibre UI never
 * touches EONET, its 60 req/min budget, or its axis-transposed bbox.
 *
 * GeoJSON shapes are declared locally on purpose — we do NOT pull in
 * `geojson`/`@types/geojson` for a handful of Point features.
 */
export interface SituationFeatureProperties {
  /** EONET event id, e.g. "EONET_20860". */
  id: string;
  title: string;
  /** EONET category id, e.g. "floods" | "wildfires" | "severeStorms". */
  category: string;
  /** Upstream provider id, e.g. "GDACS" | "CEMS". */
  source: string;
  /** Upstream provider deep-link for the event. */
  sourceUrl: string;
  /** ISO date of the earliest geometry observation (first appearance). */
  firstDate: string;
  /** Magnitude of the earliest geometry entry, when EONET provides one. */
  magnitude?: number;
  magnitudeUnit?: string;
  /** ISO date the event ended, or null while still open. */
  closed: string | null;
}

/** A GeoJSON Point geometry ([lon, lat]). */
export interface SituationPointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

/** A GeoJSON Point Feature carrying normalized situation properties. */
export interface SituationFeature {
  type: 'Feature';
  geometry: SituationPointGeometry;
  properties: SituationFeatureProperties;
}

/**
 * Pre-sorted GeoJSON FeatureCollection of situation events, oldest first.
 * This is the stable contract the Phase 13 MapLibre layer consumes.
 */
export interface SituationFeatureCollection {
  type: 'FeatureCollection';
  features: SituationFeature[];
}

/**
 * ---------------------------------------------------------------------------
 * Aid-site contracts (Venezuela Reporta `/api/v1/sitios`)
 * ---------------------------------------------------------------------------
 * Normalized, MapLibre-facing shape for an aid site (collection center, clinic,
 * hospital, shelter, ...) sourced from Venezuela Reporta. Each site carries
 * lat/lng, so the backend pre-shapes a GeoJSON Point FeatureCollection the
 * Situation map renders directly — the frontend never touches VR nor its
 * 120 req/min budget. Attribution ("Venezuela Reporta") is required on this data.
 */

/** Known Venezuela Reporta aid-site types. Any other value is passed through as-is. */
export type AidSiteTipo = 'acopio' | 'clinica' | 'hospital' | 'refugio' | 'otro';

/** Properties carried by a normalized aid-site GeoJSON Point Feature. */
export interface AidSiteFeatureProperties {
  /** Venezuela Reporta site id. */
  id: string;
  /** Site type — whitelisted to one of {@link AidSiteTipo} ('otro' when unknown). */
  tipo: AidSiteTipo;
  /** Required attribution label carried on every feature. */
  source: string;
  nombre: string;
  municipio?: string;
  /** Free-text operational status (e.g. "operativo", "saturado"). */
  estado_operativo?: string;
  /** Declared needs at the site. Always an array (empty when none reported). */
  necesidades: string[];
  personas_estimadas?: number;
  nota?: string;
  /** Freshness bucket reported by VR (e.g. "reciente", "hoy", "antiguo"). */
  frescura?: string;
  /** ISO timestamp of the most recent report about the site. */
  ultimo_reporte_at?: string;
  /** Deep-link to the site's VR record, when present. */
  fichaUrl?: string;
}

/** A GeoJSON Point Feature carrying normalized aid-site properties. */
export interface AidSiteFeature {
  type: 'Feature';
  geometry: SituationPointGeometry;
  properties: AidSiteFeatureProperties;
}

/**
 * GeoJSON FeatureCollection of aid sites. The stable contract the Situation
 * map's "Aid sites" layer consumes.
 */
export interface AidSiteFeatureCollection {
  type: 'FeatureCollection';
  features: AidSiteFeature[];
}

/**
 * ---------------------------------------------------------------------------
 * Earthquake contracts (USGS fdsnws + FUNVISIS via SismosVE)
 * ---------------------------------------------------------------------------
 * Normalized, MapLibre-facing shape for a recent earthquake. Two independent
 * gateway routes feed this same contract so the Situation map renders both
 * sources with one layer style:
 *   - `/api/usgs/earthquakes`     → USGS fdsnws (global, bbox-filtered);
 *   - `/api/funvisis/earthquakes` → FUNVISIS data federated via the OSS
 *     SismosVE feed (Venezuela-local). Attribution "FUNVISIS (vía SismosVE)"
 *     is REQUIRED on this data.
 * The frontend never touches either upstream nor its rate budget — the volatile
 * TTL cache and degrade-safe behavior live in the gateway.
 */
export interface EarthquakeFeatureProperties {
  /** Upstream event id (USGS event id or SismosVE id). */
  id: string;
  /** Magnitude, or null when the source did not report one. */
  mag: number | null;
  /** Human place description (USGS `place` / SismosVE `addressFormatted`). */
  place: string;
  /** Event time as epoch milliseconds, or null when unparseable. */
  time: number | null;
  /** Depth in kilometers, when reported. */
  depth?: number | null;
  /** Upstream deep-link for the event, when present. */
  url?: string;
  /** Attribution label, e.g. "USGS" or "FUNVISIS (vía SismosVE)". */
  source: string;
}

/** A GeoJSON Point Feature carrying normalized earthquake properties. */
export interface EarthquakeFeature {
  type: 'Feature';
  geometry: SituationPointGeometry;
  properties: EarthquakeFeatureProperties;
}

/**
 * GeoJSON FeatureCollection of recent earthquakes. The stable contract the
 * Situation map's earthquake layers (USGS + FUNVISIS) consume.
 */
export interface EarthquakeFeatureCollection {
  type: 'FeatureCollection';
  features: EarthquakeFeature[];
}
