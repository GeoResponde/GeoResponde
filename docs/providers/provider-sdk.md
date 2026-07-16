# Provider SDK

The **Provider SDK** is the canonical documentation for all reusable backend components, transports, and shared infrastructure available for humanitarian providers. Rather than reinventing infrastructure for every new integration, adapters must consume these shared components.

## Transports

All adapters should rely on standard shared transports for fetching upstream data to guarantee timeout isolation, user-agent uniformity, and consistent error handling.

### `fetchJson`
`backend/src/transports/rest/client.ts`

Performs a single GET request against a JSON API with a hard timeout and returns the parsed body. Use this for all REST API and GraphQL integrations instead of raw `fetch()`.

### `fetchText`
`backend/src/transports/rest/client.ts`

Similar to `fetchJson` but returns the raw response body as a string. Ideal for CSVs or plain text upstreams.

## Infrastructure

### `VolatileTtlCache`
`backend/src/transports/cache.ts`

A generic, volatile, bounded, in-memory TTL cache. This is the **standard adapter-level caching mechanism** for GeoResponde.

**When to use it:**
- Upstream is extremely fragile or severely rate-limited (e.g., free tier SaaS products like Sheet2API).
- Upstream explicitly requests polling limits.

**When NOT to use it:**
- Robust enterprise APIs (e.g., USGS, official state APIs) should generally be hit directly unless they are consistently timing out.
- Do not build custom caching within the Provider Gateway; caching belongs exclusively in the adapter to isolate complexity.

**Best Practices:**
- Configure the TTL dynamically from the `HumanitarianProvider`'s `metadata` block (e.g., `provider.metadata?.cacheTtlMs`) to allow declarative tuning without modifying the adapter's code. If missing, fall back to a reasonable default (e.g., 5 minutes).
- Cache the **normalized** `NormalizedSearchResult[]` array instead of the raw API response to save processing time on subsequent hits.
- Add basic observability logging to track cache hits, misses, and fetched counts.

```typescript
import { VolatileTtlCache } from '../../transports/cache.js';

// Inside your adapter
private cache = new VolatileTtlCache<NormalizedSearchResult[]>({
  ttlMs: this.provider.metadata?.cacheTtlMs ?? 5 * 60 * 1000,
});

async search(query: string): Promise<NormalizedSearchResult[]> {
  const cacheKey = 'all';
  let results = this.cache.get(cacheKey);

  if (!results) {
    // 1. Fetch raw data
    const rawData = await fetchJson<MyData[]>(this.provider.config.url);
    // 2. Parse and normalize
    results = rawData.map(parseMyData);
    // 3. Cache the normalized results
    this.cache.set(cacheKey, results);
  }

  // 4. Return filtered results based on the search query
  return filterResults(results, query);
}
```

## Normalization & Deduplication

### `isCedula` / `normalizeCedula`
`backend/src/adapters/person.ts`

Use these helpers when the upstream resource is a person to safely parse and normalize Venezuelan national IDs for the `person.cedula` field.

### `dedupePersons`
`backend/src/gateway/dedupe.ts`

This is automatically applied by the Provider Gateway across all providers. Adapters should focus exclusively on fetching, normalizing, and returning data from their single upstream source; the gateway handles deduplication across the federation.
