# Provider Integration Template

> This is the **canonical implementation guide** for adding a provider. Discovery/research documents (e.g. [`docs/providers/research/`](./research/)) capture what an API looks like; this document is where you turn that into a working adapter. See [`docs/providers.md`](../providers.md) for how the provider documentation is organized.

This document is a reference template for integrating a new humanitarian data provider (for example, a missing persons registry, a shelter directory, or a similar civic dataset) into the GeoResponde backend. It is grounded in the existing adapters in the repository (`ayudavenezuela`, `hdx`, `encuentralos`, `reencuentra-ve`), so every pattern shown here already exists in production code. Use it alongside `CONTRIBUTING.md`, which documents the overall contribution workflow.

**Important**: Before submitting your pull request, you must ensure your integration satisfies the [Provider Definition of Done](../contributing/provider-definition-of-done.md).

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

### Caching & Rate Limiting

If your upstream API is rate-limited, fragile, or built on a free-tier service (like Sheet2API), **do not build custom caching logic**. Use the shared `VolatileTtlCache` utility. See the [Provider SDK](./provider-sdk.md) for detailed implementation instructions on how to cache normalized results safely at the adapter level.

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



## 8. Supabase / PostgREST Reference Implementations

When integrating with Supabase-backed frontend applications, follow these reference patterns established by je-ayuda-venezuela:

1. **Treat the Anon Key as Public Config**: Store the supabaseUrl and supabaseAnonKey inside providers.yaml configuration. Do not hardcode them.
2. **Use Shared Transport**: The standard etchJson transport natively accepts custom headers. Pass pikey and Authorization: Bearer alongside your requests.
3. **PostgREST Pagination**: Avoid fetching unlimited records. Pass Range: 0-99 and Range-Unit: items headers to use PostgREST native offset pagination.
4. **Verify RLS via Anon Key**: Before implementation, always ensure the table allows anonymous SELECT operations. Never implement submissions unless the provider authorizes it, even if an RPC exists.
