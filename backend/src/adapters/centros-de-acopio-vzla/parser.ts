import { NormalizedSearchResult } from '@georesponde/shared';
import { CentrosDeAcopioVzlaRoot } from './types.js';

export function parseCollectionCenters(providerId: string, data: CentrosDeAcopioVzlaRoot): NormalizedSearchResult[] {
  const results: NormalizedSearchResult[] = [];

  if (!data || !Array.isArray(data.estados)) {
    return results;
  }

  for (const estado of data.estados) {
    if (!estado || !Array.isArray(estado.ciudades)) continue;

    for (const ciudad of estado.ciudades) {
      if (!ciudad || !Array.isArray(ciudad.centros)) continue;

      for (const centro of ciudad.centros) {
        if (!centro || !centro.nombre) continue;

        const addressParts = [
          centro.direccion?.trim(),
          ciudad.nombre?.trim(),
          estado.nombre?.trim(),
          'Venezuela'
        ].filter(Boolean);

        // Deduplicate category logic and tags
        let tags: string[] = [];
        if (Array.isArray(centro.recibe)) {
          tags = centro.recibe.map(r => r.trim().toLowerCase()).filter(Boolean);
        }

        // Build unique ID. Using coords if possible, or fallback to hashing name + location
        const idStr = centro.coords 
          ? `${centro.coords[0]},${centro.coords[1]}` 
          : `${centro.nombre}-${addressParts.join('-')}`;
        
        // Simple hash function for ID (string to 32bit integer to hex)
        let hash = 0;
        for (let i = 0; i < idStr.length; i++) {
          const char = idStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const uniqueId = `cavzla-${Math.abs(hash).toString(16)}`;

        const result: NormalizedSearchResult = {
          provider_id: uniqueId,
          provider: providerId,
          type: 'shelter',
          title: centro.nombre.trim(),
          subtitle: centro.direccion?.trim(),
          url: centro.maps || '',
          metadata: {
            address: addressParts.join(', '),
            category: 'centro de acopio',
            tags: tags,
            maps: centro.maps,
            contacto: centro.contacto,
            fuente: centro.fuente,
            ciudad: ciudad.nombre,
            estado: estado.nombre
          }
        };

        if (centro.coords && Array.isArray(centro.coords) && centro.coords.length === 2) {
          result.location = [centro.coords[1], centro.coords[0]];
        }

        if (centro.maps) {
          result.url = centro.maps;
        }

        results.push(result);
      }
    }
  }

  return results;
}
