import type {
  SituationFeature,
  SituationFeatureCollection,
} from '@georesponde/shared';

/**
 * Raw NASA EONET v3 `/events` shapes — only the fields we consume are typed.
 * Everything is optional/defensive because EONET is an untrusted third-party
 * source: a malformed response must never crash the gateway (threat T-12-04).
 */
export interface EonetGeometry {
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  date?: string;
  type?: 'Point' | 'Polygon' | string;
  /** Point: [lon, lat]; Polygon: array of linear rings of [lon, lat]. */
  coordinates?: unknown;
}

export interface EonetRawEvent {
  id?: string;
  title?: string;
  closed?: string | null;
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: EonetGeometry[];
}

export interface EonetEventsResponse {
  title?: string;
  description?: string | null;
  link?: string;
  events?: EonetRawEvent[];
}

/** EONET's dead `earthquakes` category id — never surfaced (see README). */
export const EARTHQUAKES_CATEGORY = 'earthquakes';

/**
 * Earliest geometry `date` for an event (first-appearance key). EONET geometry
 * is a time series, so we take the min ISO date across all entries. Returns the
 * empty string when no usable date exists (event is then dropped downstream).
 */
export function firstDate(event: EonetRawEvent): string {
  const dates = (event.geometry ?? [])
    .map((g) => g?.date)
    .filter((d): d is string => typeof d === 'string' && d.length > 0);
  if (dates.length === 0) return '';
  return dates.reduce((min, d) => (d < min ? d : min));
}

/**
 * Return the geometry entry with the earliest date, or undefined when none is
 * usable. This is the representative observation for the collapsed map point.
 */
function earliestGeometry(event: EonetRawEvent): EonetGeometry | undefined {
  const usable = (event.geometry ?? []).filter(
    (g) => g && typeof g.date === 'string' && g.date.length > 0,
  );
  if (usable.length === 0) return undefined;
  return usable.reduce((min, g) => (g.date! < min.date! ? g : min));
}

/**
 * Extract a [lon, lat] Point from a geometry entry. Point -> its coordinates;
 * Polygon -> first coordinate of the first ring. Returns undefined for any
 * shape we cannot read as a finite [lon, lat] pair.
 */
function toPoint(geometry: EonetGeometry): [number, number] | undefined {
  const coords = geometry.coordinates;
  if (!Array.isArray(coords)) return undefined;

  let pair: unknown = coords;
  // Polygon: coordinates = [ [ [lon,lat], ... ] ] -> dig to first vertex.
  if (Array.isArray(coords[0])) {
    const firstRing = coords[0] as unknown;
    if (!Array.isArray(firstRing)) return undefined;
    pair = firstRing[0];
  }

  if (!Array.isArray(pair)) return undefined;
  const [lon, lat] = pair as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number') return undefined;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return undefined;
  return [lon, lat];
}

/**
 * Normalize one raw EONET event into a GeoJSON Point Feature, or undefined when
 * the event is unusable (no date, no readable coordinates) or belongs to the
 * dead `earthquakes` category. Pure and defensive — never throws.
 */
function toFeature(event: EonetRawEvent): SituationFeature | undefined {
  const category = event.categories?.[0]?.id;
  if (!category || category === EARTHQUAKES_CATEGORY) return undefined;

  const date = firstDate(event);
  if (!date) return undefined;

  const geometry = earliestGeometry(event);
  if (!geometry) return undefined;

  const point = toPoint(geometry);
  if (!point) return undefined;

  const magnitude =
    typeof geometry.magnitudeValue === 'number'
      ? geometry.magnitudeValue
      : undefined;
  const magnitudeUnit =
    typeof geometry.magnitudeUnit === 'string' && geometry.magnitudeUnit
      ? geometry.magnitudeUnit
      : undefined;

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: point },
    properties: {
      id: event.id ?? '',
      title: event.title ?? '',
      category,
      source: event.sources?.[0]?.id ?? '',
      sourceUrl: event.sources?.[0]?.url ?? '',
      firstDate: date,
      ...(magnitude !== undefined ? { magnitude } : {}),
      ...(magnitudeUnit !== undefined ? { magnitudeUnit } : {}),
      closed: event.closed ?? null,
    },
  };
}

/**
 * Transform a raw EONET `/events` response into a pre-sorted GeoJSON
 * FeatureCollection: one representative Point Feature per event, sorted
 * ascending by first-appearance date (oldest first), with `earthquakes` events
 * and any malformed/undated events dropped. Never throws on bad input.
 */
export function toSortedFeatureCollection(
  raw: EonetEventsResponse | unknown,
): SituationFeatureCollection {
  const events =
    raw && typeof raw === 'object' && Array.isArray((raw as EonetEventsResponse).events)
      ? ((raw as EonetEventsResponse).events as EonetRawEvent[])
      : [];

  const features = events
    .map(toFeature)
    .filter((f): f is SituationFeature => f !== undefined)
    .sort((a, b) =>
      a.properties.firstDate < b.properties.firstDate
        ? -1
        : a.properties.firstDate > b.properties.firstDate
          ? 1
          : 0,
    );

  return { type: 'FeatureCollection', features };
}
