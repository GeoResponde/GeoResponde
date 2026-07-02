import type {
  AidSiteFeature,
  AidSiteFeatureCollection,
} from '@georesponde/shared';

/**
 * The Venezuela Reporta aid-site types the Situation "Aid sites" layer renders.
 * Order drives the legend. `otro` is the catch-all for unknown types.
 */
export const AID_SITE_TIPOS = [
  'acopio',
  'clinica',
  'hospital',
  'refugio',
  'otro',
] as const;

export type AidSiteTipo = (typeof AID_SITE_TIPOS)[number];

/**
 * One distinct, dark-theme-legible color per aid-site type. Used by the MapLibre
 * `circle-color` match expression, the legend, and the popup badge so the same
 * color reads consistently across the whole layer.
 */
export const TIPO_COLORS: Record<string, string> = {
  acopio: '#22c55e', // green — collection centers
  clinica: '#14b8a6', // teal — clinics
  hospital: '#ef4444', // red — hospitals
  refugio: '#3b82f6', // blue — shelters
  otro: '#a855f7', // violet — other
};

/** Fallback color for any type not in the known set (defensive). */
export const TIPO_COLOR_FALLBACK = '#94a3b8';

export type AidSiteRenderFeature = AidSiteFeature;
export type AidSiteRenderCollection = AidSiteFeatureCollection;

const EMPTY: AidSiteRenderCollection = { type: 'FeatureCollection', features: [] };

/**
 * Defensive passthrough: accept the gateway's pre-shaped aid-site collection and
 * keep only well-formed Point features. The backend already normalizes, so this
 * mostly guards against a null/garbled body.
 */
export function toAidSiteRenderCollection(
  collection: AidSiteFeatureCollection | null | undefined,
): AidSiteRenderCollection {
  const source = collection?.features;
  if (!Array.isArray(source)) return EMPTY;
  const features = source.filter(
    (f) =>
      f &&
      f.geometry?.type === 'Point' &&
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates.length === 2,
  );
  return { type: 'FeatureCollection', features };
}
