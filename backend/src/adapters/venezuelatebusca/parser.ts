import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Searches the deeply nested object for any array named 'persons'.
 * Returns the first one found, or an empty array.
 */
export function findPersonsArray(obj: any, visited = new Set()): any[] {
  if (!obj || typeof obj !== 'object') return [];
  if (visited.has(obj)) return [];
  visited.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findPersonsArray(item, visited);
      if (result.length > 0) return result;
    }
    return [];
  }

  if ('persons' in obj && Array.isArray(obj.persons)) {
    return obj.persons;
  }

  for (const value of Object.values(obj)) {
    const result = findPersonsArray(value, visited);
    if (result.length > 0) return result;
  }

  return [];
}

/**
 * The upstream source sometimes packs several transcribed name variants into a
 * single `firstName`, separated by " / " (e.g.
 * "Marialejandra / Rodriguez Maria Alejandra / Rodriguez Marialejandra").
 * Keep only the first variant so the title and the search deep-link stay clean.
 */
function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.split('/')[0].trim();
}

/**
 * Normalizes a single structural record from Venezuela Te Busca into the standard format.
 */
export function normalizeRecord(record: any): NormalizedSearchResult {
  // Combine first and last name safely, de-duplicating a last name that is
  // already present at the end of the (cleaned) first name.
  const first = cleanName(record.firstName);
  const last = cleanName(record.lastName);
  const parts: string[] = [];
  if (first) parts.push(first);
  if (last && !first.toLowerCase().endsWith(last.toLowerCase())) parts.push(last);
  const title = parts.length > 0 ? parts.join(' ') : 'Desconocido';

  // Build snippet using available descriptions/notes
  let snippet = '';
  if (record.description) snippet += record.description + ' ';
  if (record.notes) snippet += record.notes + ' ';
  if (record.foundNote) snippet += record.foundNote + ' ';
  if (record.lastSeen) snippet += `Última vez visto: ${record.lastSeen}`;

  return {
    provider_id: record.id,
    title: title.trim(),
    subtitle: snippet.trim() || 'Sin descripción adicional.',
    url: `https://venezuelatebusca.com/?query=${encodeURIComponent(title.trim())}`,
    provider: 'Venezuela Te Busca',
    type: 'person',
    status: record.status || 'unknown',
    last_update: record.lastSeen,
    thumbnail: record.photoUrl || undefined
  };
}

export function parseVenezuelaTeBuscaStructural(deserializedData: any): NormalizedSearchResult[] {
  const persons = findPersonsArray(deserializedData);
  if (!persons || persons.length === 0) {
    return [];
  }

  return persons.map(normalizeRecord);
}
