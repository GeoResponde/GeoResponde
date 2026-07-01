export type LayerCategory = 'Scientific' | 'Infrastructure' | 'Humanitarian' | 'Logistics' | 'Community' | 'Earthquakes' | 'Geology' | 'Satellite' | 'Hazards';

export interface HumanitarianProvider {
  id: string;
  display_name: string;
  website: string;
  description: string;
  logo: string;
  status: 'active' | 'inactive' | 'degraded';
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
export type ReportTopic = 'missing-person' | 'resource-need' | 'shelter-status';

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
      { name: 'reporterContact', type: 'text', required: false },
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
      { name: 'reporterContact', type: 'text', required: false },
    ],
  },
};

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
 * Per-target outcome of a (future) submission. Deliberately provider-agnostic
 * so Phase 10's router and Phase 11's PFIF/Ushahidi adapters slot in without
 * reshaping. This phase only ever produces `mode: 'dry-run'`.
 */
export interface SubmissionResult {
  provider: string;
  mode: 'dry-run' | 'live';
  status: 'ok' | 'error' | 'skipped';
  receipt?: {
    remoteId?: string;
    url?: string;
  };
  preview?: unknown;
  error?: string;
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
