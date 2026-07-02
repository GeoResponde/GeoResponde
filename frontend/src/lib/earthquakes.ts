import type {
  EarthquakeFeature,
  EarthquakeFeatureCollection,
} from '@georesponde/shared';

export type { EarthquakeFeature, EarthquakeFeatureCollection };

/** Live/cache indicator surfaced by the gateway's `X-*-Source` header. */
export type EarthquakeSource = 'live' | 'cache' | 'empty' | null;

export const EMPTY_EARTHQUAKES: EarthquakeFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export function normalizeEarthquakeSource(raw: string | null): EarthquakeSource {
  return raw === 'live' || raw === 'cache' || raw === 'empty' ? raw : null;
}

/**
 * Defensive passthrough: accept the gateway's pre-normalized earthquake
 * collection and keep only well-formed Point features. The backend already
 * normalizes, so this mostly guards against a null/garbled body.
 */
export function toEarthquakeRenderCollection(
  collection: EarthquakeFeatureCollection | null | undefined,
): EarthquakeFeatureCollection {
  const source = collection?.features;
  if (!Array.isArray(source)) return EMPTY_EARTHQUAKES;
  const features = source.filter(
    (f): f is EarthquakeFeature =>
      !!f &&
      f.geometry?.type === 'Point' &&
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates.length === 2,
  );
  return { type: 'FeatureCollection', features };
}
