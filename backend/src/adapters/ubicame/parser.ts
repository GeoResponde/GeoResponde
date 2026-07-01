import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Shape of a single victim record inside a Úbícame letter shard.
 * The feed exposes 26 static arrays (A–Z) partitioned by the first letter of
 * `full_name`.
 */
export interface UbicameRecord {
  source?: string;
  person_record_id?: string;
  full_name?: string;
  age?: string;
  ext_venezuela_ci?: string;
  phone?: string;
  last_known_location?: string;
  hospital?: string;
  notes?: string;
  status?: string;
  source_date?: string;
}

/**
 * Pure normalization step for Úbícame. Filters the records of a single letter
 * shard down to those whose `full_name` contains `query` (case-insensitive),
 * maps them into the standard search-result shape and caps the output at 20.
 *
 * Kept free of any network access so it can be unit-tested against a fixture.
 */
export function parseUbicameShard(
  records: UbicameRecord[],
  query: string,
): NormalizedSearchResult[] {
  if (!Array.isArray(records)) return [];

  const needle = query.toLowerCase();

  return records
    .filter((r) => (r.full_name ?? '').toLowerCase().includes(needle))
    .slice(0, 20)
    .map((r) => {
      const subtitle = [r.last_known_location, r.hospital, r.notes]
        .filter((part) => part && part.trim().length > 0)
        .join(' · ');

      const fullName = r.full_name ?? '';

      return {
        provider: 'Úbícame',
        provider_id: r.person_record_id ?? '',
        type: 'person',
        title: fullName,
        subtitle: subtitle || undefined,
        status: r.status,
        last_update: r.source_date,
        // The site is a static SPA with no per-person page and no URL-seeded
        // search, so link to the site home rather than a dead query string.
        url: 'https://911.ubica.me/',
        metadata: {
          age: r.age,
          cedula: r.ext_venezuela_ci,
          source: r.source,
          phone: r.phone,
        },
      } satisfies NormalizedSearchResult;
    });
}
