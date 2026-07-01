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

export type Gender = 'male' | 'female' | 'other' | 'unknown';

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
  metadata?: Record<string, any>;
}

export interface SubmissionPackage {
  type: string;
  payload: Record<string, any>;
  timestamp: string;
}
