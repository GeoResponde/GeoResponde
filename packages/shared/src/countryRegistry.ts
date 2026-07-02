/**
 * {iso2 -> bbox} country registry (Phase 12, seeds EON-04).
 *
 * EONET exposes NO country/admin filter, so a country is filtered by its
 * bounding box. This registry is the single source of truth for those boxes,
 * seeded now (in shared) even though the situation-map UI only consumes it in
 * Phase 13 — keeping "filter by country" generalizable as data, not code.
 *
 * IMPORTANT — EONET bbox axis order is W, N, E, S:
 *   [minLon, maxLat, maxLon, minLat]
 * i.e. EONET transposes maxLat BEFORE maxLon, which is NOT the usual GeoJSON
 * order. `bboxToEonetParam` joins the tuple as-is, so store boxes in this exact
 * order. Adding a country = drop in an iso2 key with its [W, N, E, S] box.
 */

/** EONET bounding box: [minLon (W), maxLat (N), maxLon (E), minLat (S)]. */
export type Bbox = [number, number, number, number];

/**
 * iso2 (uppercase) -> EONET bbox. Seeded with Venezuela; the box leaks slivers
 * of Colombia/Guyana/Brazil and Caribbean waters (rectangular, not shaped) —
 * Phase 13 may refine with a point-in-polygon pass, out of scope here.
 */
export const COUNTRY_BBOX: Record<string, Bbox> = {
  VE: [-73.4, 12.2, -59.8, 0.6],
};

/**
 * Return the comma-joined EONET `bbox` param string for a country iso2 code
 * (case-insensitive), or undefined when the country is not registered.
 * Example: bboxToEonetParam('VE') -> "-73.4,12.2,-59.8,0.6".
 */
export function bboxToEonetParam(iso2: string): string | undefined {
  const box = COUNTRY_BBOX[iso2?.toUpperCase()];
  return box ? box.join(',') : undefined;
}
