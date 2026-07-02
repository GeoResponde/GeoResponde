import { NormalizedSearchResult, PersonRecord } from '@georesponde/shared';
import { normalizeCedula } from '../adapters/person.js';

/** Normalize a name for comparison: strip accents/punctuation, lowercase, collapse spaces. */
function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Conservative merge key for a person result:
 * - a full (unmasked, >= 7 digit) cédula, OR
 * - normalized full name AND a known age.
 * Returns null when there is no reliable key (never merge on name alone).
 */
export function personMergeKey(result: NormalizedSearchResult): string | null {
  if (result.type !== 'person') return null;
  const p = result.person;
  const name = normalizeName(p?.fullName ?? result.title);

  const digits = normalizeCedula(p?.cedula);
  if (digits.length >= 7) return `ced:${digits}`;

  if (name && typeof p?.age === 'number') return `na:${name}|${p.age}`;
  return null;
}

/** How complete a person result is — higher wins when picking the representative. */
function completeness(result: NormalizedSearchResult): number {
  const p: PersonRecord = result.person ?? {};
  let score = 0;
  for (const v of Object.values(p)) {
    if (v !== undefined && v !== null && v !== '') score += 1;
  }
  if (p.photoUrl) score += 1;
  if (p.verified) score += 1;
  if (normalizeCedula(p.cedula).length >= 7) score += 2;
  return score;
}

/** Fill undefined/empty fields of `into` from `from` (shallow, person record). */
function fillMissing(into: PersonRecord, from: PersonRecord): void {
  for (const key of Object.keys(from) as Array<keyof PersonRecord>) {
    const cur = into[key];
    if ((cur === undefined || cur === null || cur === '') && from[key] != null) {
      (into as Record<string, unknown>)[key] = from[key];
    }
  }
}

/**
 * Collapse person results that clearly refer to the same person (many of these
 * providers aggregate one another). Non-person results and persons without a
 * reliable key pass through untouched. The representative keeps the most
 * complete person data; the others are recorded in `sources` for provenance.
 */
export function dedupePersons(results: NormalizedSearchResult[]): NormalizedSearchResult[] {
  const clusters = new Map<string, NormalizedSearchResult[]>();
  const output: NormalizedSearchResult[] = [];
  const clusterOrder: string[] = [];

  for (const r of results) {
    const key = personMergeKey(r);
    if (!key) {
      output.push(r); // non-person or unmatchable — keep as-is, in place
      continue;
    }
    if (!clusters.has(key)) {
      clusters.set(key, []);
      clusterOrder.push(key);
      output.push({ __clusterKey: key } as unknown as NormalizedSearchResult); // placeholder to preserve order
    }
    clusters.get(key)!.push(r);
  }

  // Resolve placeholders into merged representatives.
  return output.map((r) => {
    const key = (r as unknown as { __clusterKey?: string }).__clusterKey;
    if (!key) return r;
    const members = clusters.get(key)!;
    if (members.length === 1) return members[0];

    const representative = [...members].sort((a, b) => completeness(b) - completeness(a))[0];
    const merged: NormalizedSearchResult = {
      ...representative,
      person: { ...(representative.person ?? {}) },
    };
    const seenProviders = new Set<string>([merged.provider]);
    const sources: Array<{ provider: string; url: string }> = [];
    for (const m of members) {
      if (m === representative) continue;
      if (m.person) fillMissing(merged.person!, m.person);
      if (!seenProviders.has(m.provider)) {
        seenProviders.add(m.provider);
        sources.push({ provider: m.provider, url: m.url });
      }
    }
    merged.sources = sources;
    merged.metadata = { ...(merged.metadata ?? {}), duplicate_count: members.length };
    return merged;
  });
}
