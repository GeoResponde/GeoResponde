import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Subset of a user record returned by the JSONPlaceholder demo API
 * (https://jsonplaceholder.typicode.com/users). Only the fields we consume
 * are typed; the API returns a few more.
 */
export interface JsonPlaceholderUser {
  id: number;
  name?: string;
  username?: string;
  email?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
  };
  company?: {
    name?: string;
    catchPhrase?: string;
  };
}

const PROFILE_BASE_URL = 'https://jsonplaceholder.typicode.com/users/';

/**
 * Normalize a single JSONPlaceholder user into the gateway's standard result
 * shape. This provider is a reference/demo integration, not a real
 * humanitarian source: the SDK docs and `docs/providers/sdk-reference.md`
 * point new contributors here as a worked, runnable example.
 */
export function normalizeUser(user: JsonPlaceholderUser): NormalizedSearchResult {
  const subtitleParts: string[] = [];
  if (user.address?.city) subtitleParts.push(user.address.city);
  if (user.company?.name) subtitleParts.push(`Org: ${user.company.name}`);

  return {
    provider: 'Example Reference Provider',
    provider_id: String(user.id),
    type: 'reference',
    title: user.name?.trim() || user.username || `User ${user.id}`,
    subtitle: subtitleParts.join(' · ') || undefined,
    url: `${PROFILE_BASE_URL}${user.id}`,
    metadata: {
      username: user.username,
      email: user.email,
      website: user.website,
      company: user.company?.name,
      catchPhrase: user.company?.catchPhrase,
    },
  };
}

/**
 * Parse a full JSONPlaceholder users response into normalized results.
 */
export function parseUsersResponse(
  response: JsonPlaceholderUser[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) return [];
  return response.map(normalizeUser);
}
