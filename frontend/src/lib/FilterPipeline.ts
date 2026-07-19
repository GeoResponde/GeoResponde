import type { Layer } from '@georesponde/catalog';

export interface ActiveFilters {
  /** 
   * Global temporal interval filter [startEpoch, endEpoch].
   * Applies to layers that expose a `timestampField`.
   */
  timeRange?: [number, number];
}

/**
 * Global Filter Pipeline
 * 
 * Constructs MapLibre/Mapbox GL style filter expressions by composing
 * the global application state (ActiveFilters) with the layer's metadata.
 */
export function buildLayerFilter(layer: Layer, activeFilters: ActiveFilters): any[] | null {
  const conditions: any[] = [];

  // 1. Temporal Range Filter
  if (activeFilters.timeRange && layer.timestampField) {
    const [start, end] = activeFilters.timeRange;
    
    // If the timestamp is ISO-formatted, we compare as strings.
    // If epoch, we convert to number (or assume it is a number).
    if (layer.timestampFormat === 'iso') {
      const startIso = new Date(start).toISOString();
      const endIso = new Date(end).toISOString();
      
      conditions.push(['>=', ['get', layer.timestampField], startIso]);
      conditions.push(['<=', ['get', layer.timestampField], endIso]);
    } else {
      // Default to epoch timestamp
      conditions.push(['>=', ['to-number', ['get', layer.timestampField]], start]);
      conditions.push(['<=', ['to-number', ['get', layer.timestampField]], end]);
    }
  }

  if (conditions.length === 0) {
    return null;
  }

  return ['all', ...conditions];
}
