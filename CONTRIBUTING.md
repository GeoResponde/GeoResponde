# Contributing to GeoResponde

We welcome contributions from developers, researchers, and humanitarian organizations!

---

## Philosophy

GeoResponde is not intended to replace existing humanitarian platforms.

Its mission is to improve interoperability between organizations by connecting existing data sources through open, well-documented integrations while always respecting data ownership and attribution.

When possible, contributors should prioritize official APIs over scraping and avoid duplicating information already maintained by partner organizations.

---

## Branching Strategy

Please do not commit directly to `main`.

All contributions should be made through a dedicated branch and submitted as a Pull Request.

Recommended branch naming:

- `feature/...` — New features
- `provider/...` — Humanitarian provider integrations
- `layer/...` — Scientific and geospatial layers
- `sdk/...` — Provider SDK improvements
- `fix/...` — Bug fixes
- `docs/...` — Documentation

Examples:

provider/terremotovenezuela
provider/cruz-roja
layer/geofon
feature/mobile-responsive
fix/search-scroll
docs/readme

---

## General Workflow

1. Fork the repository.
2. Create a dedicated branch.
3. Commit your changes.
4. Open a Pull Request.
5. Wait for review before merging.

---

## Adding a Provider

Adding a new humanitarian or scientific provider is the most common way to contribute. Please follow this standard workflow to ensure your provider integrates correctly into the architecture:

1. **Investigation**: Inspect the target provider's network traffic. Identify the most robust data endpoint available (e.g. public API, JSON feed, Supabase endpoints, ArcGIS feature services). Official APIs should always be preferred. Web scraping (parsing HTML) should only be considered as a last resort when no official integration mechanism exists..
2. **Transport Selection**: Determine if an existing transport in `backend/src/transports/` fits your needs (like `REST` or `Remix Single Fetch`). If not, implement a generic transport client that others can reuse.
3. **Parser**: Create a dedicated `parser.ts` to deserialize and traverse the response data structurally. Do not rely on fragile Regex extractions.
4. **Normalization**: Map the parsed fields into the strictly typed `NormalizedSearchResult` interface expected by the Provider Gateway.
5. **Validation**: Save a response payload in your provider's `fixtures/` directory and write Vitest tests to prevent future regressions. **Do not commit real personal data.** When a provider returns sensitive personal information (names, ID numbers, photos, contact details of missing or affected people), use an **anonymized/synthetic fixture** that mirrors the exact field names and shape but replaces the values with fake data. Federating this data live is fine (GeoResponde only links back to the source); persisting it in the repository is not.
6. **Registration**: Export an Adapter class that implements `BaseAdapter` and register it in the adapter registry at `backend/src/adapters/registry.ts` (via `registerAdapter('YourAdapter', YourAdapter)`), then add the provider entry to `data/catalog/providers/providers.yaml` and `public/catalog/providers.json`. The Provider Gateway resolves adapters through the registry, so you no longer edit `ProviderGateway.ts` to add a provider.
7. **Testing**: Spin up the development server and verify the integration through the generic developer endpoint `/api/dev/inspect/:id`, where `:id` is your provider's catalog id (e.g. `GET /api/dev/inspect/prov-hdx?q=venezuela`). It runs your adapter in isolation and returns a diagnostic with the normalized result count and a small sample.
