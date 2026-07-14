import type { NormalizedSearchResult } from '@georesponde/shared';
import type { TeBuscoRecord } from './types.js';
import { makeStatusMapper, normalizeGender } from '../person.js';

const toStatus = makeStatusMapper({
  search: 'missing',
  hurt: 'hospitalized', // they are injured, mapped to hospitalized/unknown
  located: 'found',
  safe: 'safe',
  reunited: 'found',
  gone: 'unknown' // 'gone' is 'INFO SENSIBLE', better map to unknown or deceased, we'll map to unknown
});

export function normalizeRecord(record: TeBuscoRecord): NormalizedSearchResult {
  const url = `https://tebusco.app/`;

  return {
    provider: 'Te Busco',
    provider_id: record.uid,
    type: 'person',
    title: record.name || 'Desconocido',
    status: toStatus(record.state),
    last_update: record.updated_at || new Date(record.ts).toISOString(),
    url,
    person: {
      fullName: record.name || undefined,
      status: toStatus(record.state),
      rawStatus: record.state,
      lastSeenLocation: record.place || undefined,
      description: record.msg || undefined,
    },
    metadata: {
      by_who: record.by_who,
      phone: record.phone
    }
  };
}

export function parseTeBuscoResponse(
  response: TeBuscoRecord[] | undefined | null
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) {
    return [];
  }
  return response.map(normalizeRecord);
}
