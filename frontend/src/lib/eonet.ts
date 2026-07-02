import type {
  SituationFeature,
  SituationFeatureCollection,
} from '@georesponde/shared';

/**
 * The five live, Venezuela-relevant EONET categories that the Phase 12 gateway
 * surfaces. The dead `earthquakes` category is intentionally absent — the
 * backend already drops it (see 13-CONTEXT / EON-05); quakes are pointed to
 * USGS instead.
 */
export const EONET_CATEGORIES = [
  'floods',
  'wildfires',
  'severeStorms',
  'volcanoes',
  'landslides',
] as const;

export type EonetCategory = (typeof EONET_CATEGORIES)[number];

/**
 * One distinct, dark-theme-legible hazard color per category. Used by the
 * MapLibre `circle-color` match expression, the legend, and the list dots so
 * the same color reads consistently across the whole situation UI.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  floods: '#3b82f6', // blue
  wildfires: '#f97316', // orange
  severeStorms: '#a855f7', // violet
  volcanoes: '#ef4444', // red
  landslides: '#d97706', // amber / earth
};

/** Fallback color for any category not in the known five (defensive). */
export const CATEGORY_COLOR_FALLBACK = '#94a3b8';

/** Render-time properties: the shipped properties plus derived render fields. */
export interface RenderFeatureProperties {
  id: string;
  title: string;
  category: string;
  source: string;
  sourceUrl: string;
  firstDate: string;
  magnitude?: number;
  magnitudeUnit?: string;
  closed: string | null;
  /** `Date.parse(firstDate)` — always finite (unparseable features are dropped). */
  firstDateEpoch: number;
  /** 0-based order-of-appearance index within the sorted, kept features. */
  sequence: number;
}

export interface RenderFeature {
  type: 'Feature';
  geometry: SituationFeature['geometry'];
  properties: RenderFeatureProperties;
}

export interface RenderFeatureCollection {
  type: 'FeatureCollection';
  features: RenderFeature[];
}

/**
 * Pure transform: turn the gateway's pre-sorted `SituationFeatureCollection`
 * into a render collection where every feature keeps its original properties
 * and gains a finite `firstDateEpoch` and a 0-based `sequence`.
 *
 * Features whose `firstDate` does not parse to a finite epoch are dropped so
 * the `<=` timeline filter (13-02) never has to reason about NaN.
 */
export function toRenderCollection(
  collection: SituationFeatureCollection | null | undefined,
): RenderFeatureCollection {
  const source = collection?.features ?? [];
  const features: RenderFeature[] = [];

  for (const feature of source) {
    const firstDateEpoch = Date.parse(feature.properties.firstDate);
    if (!Number.isFinite(firstDateEpoch)) continue;
    features.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        firstDateEpoch,
        sequence: features.length,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Smallest and largest `firstDateEpoch` across the render features, used to
 * bound the timeline scrubber. Returns `{ min: null, max: null }` for an empty
 * list so the slider can disable itself.
 */
export function appearanceRange(features: RenderFeature[]): {
  min: number | null;
  max: number | null;
} {
  if (!features.length) return { min: null, max: null };
  let min = Infinity;
  let max = -Infinity;
  for (const f of features) {
    const e = f.properties.firstDateEpoch;
    if (e < min) min = e;
    if (e > max) max = e;
  }
  return { min, max };
}
