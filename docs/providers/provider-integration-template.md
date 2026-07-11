# Provider Integration Template

This document is a reference template for integrating a new humanitarian data provider (for example, a missing persons registry, a shelter directory, or a similar civic dataset) into the GeoResponde backend. It is grounded in the existing adapters in the repository (`ayudavenezuela`, `hdx`, `encuentralos`, `reencuentra-ve`), so every pattern shown here already exists in production code. Use it alongside `CONTRIBUTING.md`, which documents the overall contribution workflow, and [`docs/providers/sdk-reference.md`](./sdk-reference.md), the API/type reference for the `BaseAdapter` contract, `NormalizedSearchResult`, transports, and registration — this file is the worked example, that one is the reference.

If anything here conflicts with the code, the code wins. This file describes what the code does today, not an aspirational design.

## 1. Provider folder structure

Every adapter lives under `backend/src/adapters/<provider-id>/` and follows the same shape, regardless of whether the source is a JSON API or an HTML page to scrape:

```
backend/src/adapters/<provider-id>/
  adapter.ts          # class implementing BaseAdapter, owns the fetch call
  parser.ts           # pure functions that turn raw responses into NormalizedSearchResult[]
  __tests__/
    parser.test.ts    # vitest tests against the fixtures below
  fixtures/
    <name>.json        # or .html for scraped providers, synthetic sample data
```

Two other files outside the provider folder need to be touched once the adapter exists:

- `backend/src/adapters/registry.ts`, where the adapter class gets imported and registered.
- `public/catalog/providers.json` (and the source YAML at `data/catalog/providers/providers.yaml`), where the provider gets a catalog entry.

This is exactly what you see for `ayudavenezuela`, `hdx`, `encuentralos` and `reencuentra-ve`: each has `adapter.ts`, `parser.ts`, one `parser.test.ts` under `__tests__/`, and one fixture file under `fixtures/`.

## 2. Required files

- **`adapter.ts`** exports a class that implements the `BaseAdapter` interface from `backend/src/adapters/BaseAdapter.ts`. It holds the `provider` field, the constructor, and the `search` (and `submit`) methods. This is also where the network call happens, using one of the shared transport helpers.
- **`parser.ts`** exports one or more pure functions that take the raw response (already fetched) and return `NormalizedSearchResult[]`. It must not perform any network calls itself. It typically also exports the TypeScript interface describing the raw API/HTML shape (see `AyudaVenezuelaItem`, `HdxDataset`, `EncuentralosResponse`) so the parser stays strongly typed.
- **`__tests__/parser.test.ts`** imports the parser and a fixture file, and asserts on the shape of the normalized output field by field. It never talks to the network and never depends on adapter.ts.
- **`fixtures/`** holds one or more synthetic sample payloads (JSON for API providers, HTML for scraped ones) that the parser test reads from disk with `fs.readFileSync`.

## 3. Adapter lifecycle

`BaseAdapter` (in `backend/src/adapters/BaseAdapter.ts`) is the contract every adapter must satisfy:

```ts
export interface BaseAdapter {
  provider: HumanitarianProvider;
  search(query: string, domain?: string): Promise<NormalizedSearchResult[]>;
  submit(report: Report, opts?: SubmitOptions): Promise<SubmissionResult>;

  // optional, additive fields used by later phases of the router:
  submissionMode?: SubmissionMode;
  submissionTopics?: readonly ReportTopic[];
  retryable?: boolean;
  getGeoJSON?(): Promise<any>;
}
```

Every existing search-only adapter follows the same constructor shape:

```ts
constructor(providerConfig: HumanitarianProvider) {
  this.provider = providerConfig;
}
```

`search(query, domain?)` is the method the Provider Gateway actually calls when a user searches. It is expected to catch its own errors internally and return an empty array on failure rather than throwing (every existing adapter wraps the fetch and parse calls in a try/catch and logs to the console before returning `[]`).

`submit(report, opts?)` exists on every adapter because it is part of the interface, but for providers that only support read/search (which is the common case for missing-person registries with no reporting API), it is a stub that returns a `dry-run` / `skipped` result:

```ts
async submit(_report: Report): Promise<SubmissionResult> {
  return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
}
```

Only implement the optional fields (`submissionMode`, `submissionTopics`, `retryable`, `getGeoJSON`) if your provider actually supports submissions or exposes a live GeoJSON layer. Most new missing-persons integrations will not need them.

The registry (`backend/src/adapters/registry.ts`) maps the `adapter` string declared in the provider catalog entry to the adapter class, and `createAdapter(provider)` instantiates it on demand:

```ts
export function createAdapter(provider: HumanitarianProvider): BaseAdapter | undefined {
  const Ctor = registry.get(provider.adapter);
  return Ctor ? new Ctor(provider) : undefined;
}
```

This is the only place the Provider Gateway needs to know about your adapter. Nothing in `ProviderGateway.ts` needs editing to add a new provider, as CONTRIBUTING.md also notes.

## 4. Parser guidelines

- The parser must be pure: no `fetch`, no I/O, no console logging, no reading environment variables. Given the same input object, it always produces the same output array.
- Fetching happens exclusively in `adapter.ts`, using one of the shared transport helpers described below. The raw response is then handed to the parser.
- Parser tests run only against the synthetic fixtures checked into `fixtures/`. Never write a parser test that reaches out to the real provider over the network.
- Never let real personally identifiable information reach the parser tests or fixtures. See section 5 below.
- Reuse the shared normalization helpers in `backend/src/adapters/person.ts` (`makeStatusMapper`, `normalizeGender`) when your provider deals with people, instead of writing new ad hoc status mapping logic per provider.

### Real transport helpers

Two generic transports exist under `backend/src/transports/` and should cover almost every case:

- `fetchJson<T>(url, options?)` from `backend/src/transports/rest/client.ts`. Performs a single GET against a JSON endpoint with a hard timeout (default 8000ms) and optional headers, strips a leading BOM, and returns the parsed body as `T`. Used by `ayudavenezuela`, `hdx`, and `encuentralos`.
- `fetchHtml(url, options?)` from `backend/src/transports/scrape/client.ts`. Performs a single GET against an HTML page with a hard timeout (default 10000ms) and returns a loaded Cheerio instance. Used by `reencuentra-ve`, which then re-serializes the DOM with `$.html()` and hands the raw string to the parser, keeping all DOM traversal logic inside `parser.ts` rather than `adapter.ts`.

There is also `backend/src/transports/remix/client.ts` (with a companion `deserializer.ts`) for providers that expose data through a Remix "single fetch" endpoint, and `backend/src/transports/rest/postClient.ts` for POST-based REST calls. Check whether one of these already fits before writing a new transport. If nothing fits, CONTRIBUTING.md asks contributors to add a new generic, reusable transport client rather than a one-off fetch call buried in the adapter.

An official JSON/XHR endpoint should always be preferred over scraping HTML. Both `fetchJson` and `fetchHtml` exist and are equally supported, but scraping is explicitly documented as a last resort for providers with no machine-readable data source.

## 5. Fixtures

Fixtures must be synthetic. Real missing-person records carry personally identifiable information (full names, ages, physical descriptions, photos, contact details) that must never be committed to a public repository, even though federating that same data live at query time is fine, because GeoResponde only links back to the source and never persists it.

Follow the naming pattern already used in the repository: name the fixture after the real endpoint or the real page it represents (`person_reports_public.json`, `package_search.json`, `personas.json`, `buscar.html`), but replace every value with fake data while keeping the exact field names and shape the real response has. Look at `backend/src/adapters/ayudavenezuela/fixtures/person_reports_public.json` for the pattern: names like "Ana Prueba" and "Carlos Ejemplo", placeholder locations like "Estado Ejemplo" and "Municipio Ficticio", a fake photo URL under `example.com`, and UUIDs that are obviously synthetic (`00000000-0000-0000-0000-0000000000a1`).

## 6. Testing

The backend uses vitest (confirmed in `backend/package.json`: `"vitest": "^1.6.1"` and the `"test": "vitest run"` script, and every existing `parser.test.ts` imports `describe`, `it`, `expect` from `vitest`).

Run the backend test suite from the `backend/` directory with:

```
npm run test
```

(equivalent to `vitest run`).

Parser tests read the fixture from disk, call the parser, and assert field by field on the normalized output, following the pattern in `backend/src/adapters/ayudavenezuela/__tests__/parser.test.ts` and `backend/src/adapters/reencuentra-ve/__tests__/parser.test.ts`: one test asserting the total count of parsed results, one or more tests asserting the exact mapped fields for specific records, and one test asserting the parser degrades gracefully (empty array) on missing or malformed input.

If you need a stand-in adapter while wiring up the rest of the system (for example, to test the Provider Gateway or the submission router without a live provider), the repository already has one at `backend/src/testing/MockHumanitarianAdapter.ts`. It implements `BaseAdapter` fully, including the optional `submissionMode`, `submissionTopics`, and `retryable` fields, and simulates latency and fake results. It is meant for tests and prototyping, not as a starting point to copy for a real integration.

## 7. Registration

Two files need to change once your adapter and parser exist:

**`backend/src/adapters/registry.ts`**, add the import and one registration line:

```ts
import { YourProviderAdapter } from './your-provider-id/adapter.js';
// ...
registerAdapter('YourProviderAdapter', YourProviderAdapter);
```

**`public/catalog/providers.json`** (and its source `data/catalog/providers/providers.yaml`), add a catalog entry. The real shape, taken from the existing `prov-venezuelatebusca` entry, is:

```json
{
  "id": "prov-your-provider-id",
  "display_name": "Your Provider Display Name",
  "website": "https://your-provider.example/",
  "description": "One sentence describing what this provider tracks.",
  "logo": "/logos/your-provider-id.png",
  "status": "active",
  "adapter": "YourProviderAdapter",
  "capabilities": [
    "search",
    "person_lookup"
  ]
}
```

`adapter` must match the string you passed to `registerAdapter`. `capabilities` is a plain string array (`HumanitarianProvider.capabilities: string[]`); only add `"submission"` if the adapter actually implements a working submit flow and declares `submissionTopics`, since `isSubmissionCapable()` in `BaseAdapter.ts` checks both.

## 8. Pull Request checklist

- [ ] Fixtures are synthetic only, no real personal data anywhere in `fixtures/`
- [ ] Parser unit tests pass (`npm run test` in `backend/`)
- [ ] Catalog entry added to `public/catalog/providers.json` (and `data/catalog/providers/providers.yaml`)
- [ ] Adapter registered in `backend/src/adapters/registry.ts`
- [ ] Integration verified through the developer inspector endpoint (`GET /api/dev/inspect/:id`, per step 7 of "Adding a Provider" in CONTRIBUTING.md)
- [ ] An official API or JSON/XHR endpoint was used instead of HTML scraping, unless no such source exists for this provider
- [ ] PR opened from a fork, following the branching workflow in CONTRIBUTING.md

## Appendix: minimal copy-pasteable skeleton

Run `pnpm scaffold:provider <provider-id>` to generate this exact skeleton on disk under
`backend/src/adapters/<provider-id>/` instead of copy-pasting it by hand (see
`docs/providers/sdk-reference.md`, section 6).

### `adapter.ts`

```ts
import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseYourProviderResponse, YourProviderItem } from './parser.js';

const API_BASE = 'https://your-provider.example/api/records';

/**
 * Adapter for Your Provider (https://your-provider.example/), a missing
 * persons registry exposing a public JSON endpoint.
 */
export class YourProviderAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[YourProviderAdapter] Fetching data for query: "${query}"`);

      const url = `${API_BASE}?q=${encodeURIComponent(query)}&limit=20`;
      const response = await fetchJson<YourProviderItem[]>(url, { timeoutMs: 10000 });

      const normalizedResults = parseYourProviderResponse(response);

      console.log(
        `[YourProviderAdapter] Extracted ${normalizedResults.length} normalized results for query: "${query}"`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[YourProviderAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
```

### `parser.ts`

```ts
import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';

/**
 * Shape of a single record returned by Your Provider's public API. Only the
 * fields we consume are typed; the API may return more columns.
 */
export interface YourProviderItem {
  id: string;
  full_name?: string | null;
  age?: number | null;
  sex?: string | null;
  status?: string | null;
  last_seen_location?: string | null;
  photo_url?: string | null;
  updated_at?: string | null;
}

const toStatus = makeStatusMapper({
  desaparecido: 'missing',
  encontrado: 'found',
});

export function normalizeRecord(record: YourProviderItem): NormalizedSearchResult {
  return {
    provider: 'Your Provider Display Name',
    provider_id: record.id,
    type: 'person',
    title: record.full_name || 'Desconocido',
    status: record.status ?? undefined,
    last_update: record.updated_at ?? undefined,
    thumbnail: record.photo_url ?? undefined,
    url: `https://your-provider.example/persona/${record.id}`,
    person: {
      fullName: record.full_name ?? undefined,
      age: typeof record.age === 'number' ? record.age : undefined,
      gender: normalizeGender(record.sex),
      status: toStatus(record.status),
      rawStatus: record.status ?? undefined,
      lastSeenLocation: record.last_seen_location ?? undefined,
      photoUrl: record.photo_url ?? undefined,
    },
    metadata: {},
  };
}

/**
 * Pure parser: maps Your Provider's array response into normalized search
 * results. Returns an empty array when the input is not an array.
 */
export function parseYourProviderResponse(
  response: YourProviderItem[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map(normalizeRecord);
}
```

### `__tests__/parser.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseYourProviderResponse } from '../parser.js';

describe('Your Provider Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/records.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parseYourProviderResponse(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps the first record correctly', () => {
    const [first] = parseYourProviderResponse(fixture);
    expect(first.provider).toBe('Your Provider Display Name');
    expect(first.type).toBe('person');
    expect(first.title).toBeTruthy();
  });

  it('returns an empty array when input is not an array', () => {
    expect(parseYourProviderResponse(undefined)).toEqual([]);
    expect(parseYourProviderResponse(null)).toEqual([]);
    expect(parseYourProviderResponse({} as any)).toEqual([]);
  });
});
```
