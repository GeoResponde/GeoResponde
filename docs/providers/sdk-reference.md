# Provider SDK Reference

This document is the API/type reference for GeoResponde's provider SDK: the `BaseAdapter`
contract, the `NormalizedSearchResult` type, the transport helpers under
`backend/src/transports/`, and how registration wires a provider into the Provider Gateway.

It complements, and does not duplicate, [`docs/providers/provider-integration-template.md`](./provider-integration-template.md),
which walks through building a real adapter step by step. Read the template first if you are
adding a provider; come back here when you need the exact contract a method or type exposes. A
minimal, runnable, fully wired example following this SDK lives at
[`backend/src/adapters/example-reference/`](../../backend/src/adapters/example-reference/) — it
is the first real consumer of everything documented below.

If anything here conflicts with the code, the code wins.

## 1. The `BaseAdapter` contract

Defined in [`backend/src/adapters/BaseAdapter.ts`](../../backend/src/adapters/BaseAdapter.ts):

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

### Lifecycle: construct → search → normalize

1. **Construct.** The registry (`createAdapter`, section 4) instantiates your adapter class
   with the `HumanitarianProvider` catalog entry that matched a request's `adapter` field. Every
   adapter stores it verbatim as `this.provider`:

   ```ts
   constructor(providerConfig: HumanitarianProvider) {
     this.provider = providerConfig;
   }
   ```

2. **Search.** The Provider Gateway calls `search(query, domain?)` when a user searches.
   `search` owns the network call — it fetches the raw upstream response using a transport
   helper (section 3), then hands that raw response to a pure function in `parser.ts` to
   normalize it. `search` must never throw: every existing adapter wraps the fetch + parse call
   in `try/catch`, logs the error, and returns `[]` on failure so one failing provider never
   breaks a federated search across all providers.

3. **Normalize.** The parser maps the provider's raw shape onto `NormalizedSearchResult[]`
   (section 2). Parsing is pure — no network calls, no I/O, no `console.log` — so it can be unit
   tested against fixtures without touching the network (see SDK-03 testing utilities, section 5).

4. **Submit (optional).** `submit(report, opts?)` exists on every adapter because it is part of
   the interface. For search-only providers (most missing-persons registries have no reporting
   API) it is a stub:

   ```ts
   async submit(_report: Report): Promise<SubmissionResult> {
     return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
   }
   ```

   Only implement the optional `submissionMode`, `submissionTopics`, `retryable`, and
   `getGeoJSON` fields if the provider genuinely supports submissions or exposes a live GeoJSON
   layer — see `isSubmissionCapable()` in `BaseAdapter.ts`, which requires both the
   `"submission"` capability in the catalog entry AND a non-empty `submissionTopics` array before
   an adapter is treated as a submission target.

## 2. `NormalizedSearchResult`

Defined in [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts). This is the one
shape every adapter's parser must produce, regardless of what the upstream API looks like:

```ts
export interface NormalizedSearchResult {
  provider: string;
  provider_id: string;
  type: string; // 'person', 'building', 'shelter', etc.
  title: string;
  subtitle?: string;
  status?: string;
  location?: [number, number]; // [lng, lat]
  last_update?: string;
  confidence?: number;
  url: string;
  thumbnail?: string;
  person?: PersonRecord;
  sources?: Array<{ provider: string; url: string }>;
  metadata?: Record<string, any>;
}
```

Required fields: `provider`, `provider_id`, `type`, `title`, `url`. Everything else is optional —
populate what the upstream source actually exposes. When `type === 'person'`, also populate the
structured `person: PersonRecord` field (see `packages/shared/src/types.ts` for its shape and
`backend/src/adapters/person.ts` for the `normalizeGender` / `makeStatusMapper` helpers that map
provider-specific vocabularies onto it) instead of inventing new ad hoc fields.

`metadata` is the escape hatch for provider-specific data that doesn't fit the normalized shape
and isn't worth promoting to a first-class field.

## 3. Transport helpers (`backend/src/transports/`)

Adapters never call `fetch` directly. Reuse one of these:

| Helper | File | Use when |
| --- | --- | --- |
| `fetchJson<T>(url, options?)` | `backend/src/transports/rest/client.ts` | The provider exposes a JSON GET endpoint (the common case). 8000ms default timeout, strips a leading BOM, parses and returns `T`. |
| `fetchHtml(url, options?)` | `backend/src/transports/scrape/client.ts` | No JSON/XHR endpoint exists and the provider must be scraped. 10000ms default timeout, returns a loaded Cheerio instance. Last resort — see CONTRIBUTING.md. |
| `fetchRemixSingleFetch<T>(baseUrl, routeId, queryParams, timeoutMs?)` | `backend/src/transports/remix/client.ts` (+ `deserializer.ts`) | The provider is a Remix app exposing data through its "single fetch" `.data` route convention. |
| `postJson<T>(url, body, options?)` | `backend/src/transports/rest/postClient.ts` | Submitting a report via POST. Handles `Idempotency-Key`, a conservative single retry on network error / 502-504 (only when idempotent and `retryable !== false`), never retries a 4xx. |

If none of these fit a new provider's transport shape, add a new generic, reusable client under
`backend/src/transports/` rather than a one-off `fetch` call embedded in `adapter.ts` — see
CONTRIBUTING.md.

## 4. Registration (`backend/src/adapters/registry.ts`)

The registry maps the `adapter` string in a provider's catalog entry to the adapter class:

```ts
export function registerAdapter(name: string, ctor: AdapterConstructor): void {
  registry.set(name, ctor);
}

export function createAdapter(provider: HumanitarianProvider): BaseAdapter | undefined {
  const Ctor = registry.get(provider.adapter);
  return Ctor ? new Ctor(provider) : undefined;
}
```

Built-in adapters register themselves at the bottom of `registry.ts`:

```ts
import { YourProviderAdapter } from './your-provider-id/adapter.js';
// ...
registerAdapter('YourProviderAdapter', YourProviderAdapter);
```

This is the only place that needs to know about your adapter class — nothing in the gateway
routing needs editing to add a new provider. `registeredAdapters()` lists every registered name,
useful for diagnostics, and `registerAdapter` can also be called at runtime (used by tests to
register ad hoc mock adapters without touching the built-in list).

### Catalog wiring (`public/catalog/providers.json`)

The registry only knows adapter classes; the catalog (`public/catalog/providers.json`, generated
from `data/catalog/providers/providers.yaml` via `pnpm catalog:build`) is what tells the gateway
which providers exist and which adapter each one uses. A catalog entry is a `HumanitarianProvider`
(`packages/shared/src/types.ts`):

```json
{
  "id": "prov-your-provider-id",
  "display_name": "Your Provider Display Name",
  "website": "https://your-provider.example/",
  "description": "One sentence describing what this provider tracks.",
  "logo": "/logos/your-provider-id.png",
  "status": "active",
  "adapter": "YourProviderAdapter",
  "capabilities": ["search", "person_lookup"]
}
```

`adapter` must match the string passed to `registerAdapter`. `status` is one of `active`,
`inactive`, `degraded`, or `reference` — `reference` marks a non-humanitarian, SDK-demonstration
provider (see `example-reference` below) so it is never mistaken for a real data source.
`capabilities` is a plain string array; only add `"submission"` when the adapter actually
implements a working submit flow and declares `submissionTopics` (`isSubmissionCapable()` checks
both).

## 5. Testing utilities (`backend/src/adapters/testing/`)

Two helpers, exported from `backend/src/adapters/testing/index.ts`, standardize provider tests:

- **`loadFixture<T>(providerId, fixtureName)`** — reads and JSON-parses a file from
  `backend/src/adapters/<providerId>/fixtures/<fixtureName>`. Replaces the
  `fs.readFileSync(path.join(__dirname, '../fixtures/...'))` boilerplate every parser test
  otherwise repeats.
- **`expectNormalizedResult(result)`** — a Vitest assertion helper that fails the current test
  unless `result` conforms to the `NormalizedSearchResult` shape (required fields present with
  the right types; optional fields, when present, correctly typed). Run it as the first
  assertion in a parser test, before asserting on provider-specific field values.

```ts
import { loadFixture, expectNormalizedResult } from '../../testing/index.js';
import { parseYourProviderResponse } from '../parser.js';

const fixture = loadFixture('your-provider-id', 'records.json');

it('produces results that conform to NormalizedSearchResult', () => {
  for (const result of parseYourProviderResponse(fixture)) {
    expectNormalizedResult(result);
  }
});
```

See `backend/src/adapters/example-reference/__tests__/parser.test.ts` for the first real
consumer of both helpers, alongside the field-by-field assertions the template in section 6 of
`provider-integration-template.md` still recommends.

## 6. Scaffolding a new provider

`scripts/scaffold-provider.js` generates the skeleton described in
`docs/providers/provider-integration-template.md` (Appendix: minimal copy-pasteable skeleton):

```bash
pnpm scaffold:provider my-provider
# equivalent to: node scripts/scaffold-provider.js my-provider
```

This creates `backend/src/adapters/my-provider/{adapter.ts,parser.ts,fixtures/,__tests__/parser.test.ts}`
with the class/type names derived from `my-provider` (`MyProvider` / `"My Provider"`). It refuses
to overwrite an existing provider folder. It does not register the adapter or touch the catalog —
that's still a manual step (section 4 above), because it requires a decision (the `adapter`
string, the catalog entry) the script can't make for you.

## 7. Versioning & stability

The `BaseAdapter` interface and the `NormalizedSearchResult` type (both in section 1 and 2 above)
are the stability contract of this SDK. Changing a required field or a method signature on either
is a **breaking change**: it can silently break every existing adapter or every downstream
consumer of search results. Any PR that changes a required field or a method signature must call
this out explicitly in its description.

There is no published npm package for this SDK today — it is an in-repo contract only, consumed
by adapters that live in this same repository (`backend/src/adapters/*`). There is no semver to
bump and no external consumers to notify beyond this repository's own code and test suite; "the
contract" simply means: don't remove or retype a required field/method without updating every
adapter that implements it and calling the change out in the PR.
