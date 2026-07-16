import { NormalizedSearchResult } from '@georesponde/shared';
import { AcopioVenezuelaAyudaItem } from './types.js';

export function parseCollectionCenters(
  providerId: string,
  items: AcopioVenezuelaAyudaItem[],
): NormalizedSearchResult[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      // "Quién" is the collection center name, mandatory for a meaningful record
      if (!item['Quién'] || !item['Quién'].trim()) {
        return null;
      }

      const title = item['Quién'].trim();
      const subtitle = item['Qué reciben']?.trim() || 'No especificado';

      const locationParts = [item['Dirección'], item['Ciudad '], item['País']]
        .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
        .map((part) => part.trim());
      
      const address = locationParts.join(', ') || undefined;

      const metadata: Record<string, string | boolean> = {};
      if (address) {
        metadata.address = address;
      }
      if (item['Contacto']?.trim()) {
        metadata.contact = item['Contacto'].trim();
      }
      if (item['Foto']?.trim() && item['Foto'].trim().toLowerCase() !== 'no') {
        metadata.photo = item['Foto'].trim();
      }
      
      // Some sheets export booleans as TRUE/FALSE, some as 1/0, some as string
      if (item['reportado']) {
        const rep = String(item['reportado']).toLowerCase().trim();
        metadata.reported = rep === 'true' || rep === '1' || rep === 'si' || rep === 'sí';
      }

      const result: NormalizedSearchResult = {
        provider_id: `acopio-${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}`,
        provider: providerId,
        type: 'collection_center',
        title,
        subtitle,
        url: 'https://acopiovenezuela.vercel.app/', // Provider doesn't expose per-item URLs
        metadata,
        last_update: new Date().toISOString(), // Sheet2API doesn't provide timestamps per row
      };

      return result;
    })
    .filter((item): item is NormalizedSearchResult => item !== null);
}
