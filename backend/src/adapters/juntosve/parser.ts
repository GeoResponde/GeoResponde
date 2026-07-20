import type { NormalizedSearchResult } from '@georesponde/shared';
import type { JuntosVeFeature } from './types.js';

export function parseJuntosVeResponse(feature: JuntosVeFeature, providerId: string): NormalizedSearchResult {
  const { geometry, properties } = feature;
  
  // Map type
  let type = 'request'; // default for rescate, comida, otro
  if (properties.type === 'refugio') {
    type = 'shelter';
  }

  // Map status
  let status = 'active';
  if (properties.status === 'resuelto') {
    status = 'inactive';
  }

  // Construct metadata
  const metadata: Record<string, any> = {};
  if (properties.capacity !== null) metadata.capacity = properties.capacity;
  if (properties.spots_available !== null) metadata.spots_available = properties.spots_available;
  if (properties.accepts !== null) metadata.accepts = properties.accepts;
  if (properties.people_count !== null) metadata.people_count = properties.people_count;

  const url = 'https://juntosve.org/';

  const title = properties.type === 'refugio' 
    ? 'Refugio / Centro de Acopio'
    : `Solicitud de Ayuda (${properties.type})`;

  return {
    provider: 'juntosVE',
    provider_id: properties.id,
    type,
    title,
    subtitle: properties.description || undefined,
    status,
    location: geometry.coordinates,
    last_update: properties.updated_at || properties.created_at,
    url,
    thumbnail: properties.photo_url || undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
