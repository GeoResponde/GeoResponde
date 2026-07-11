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

Adding a new humanitarian or scientific provider is the most common way to contribute. Please follow this standard workflow to ensure your provider integrates correctly into the architecture. See also the [Provider Integration Template](docs/providers/provider-integration-template.md) for a fully worked reference (folder structure, required files, adapter/parser skeletons and a PR checklist) grounded in the existing adapters, and the [Provider SDK Reference](docs/providers/sdk-reference.md) for the `BaseAdapter`/`NormalizedSearchResult` contract, the shared transport helpers, and how registration works. `pnpm scaffold:provider <provider-id>` generates the adapter skeleton for you.

1. **Investigation**: Inspect the target provider's network traffic. Identify the most robust data endpoint available (e.g. public API, JSON feed, Supabase endpoints, ArcGIS feature services). Official APIs should always be preferred. Web scraping (parsing HTML) should only be considered as a last resort when no official integration mechanism exists..
2. **Transport Selection**: Determine if an existing transport in `backend/src/transports/` fits your needs (like `REST` or `Remix Single Fetch`). If not, implement a generic transport client that others can reuse.
3. **Parser**: Create a dedicated `parser.ts` to deserialize and traverse the response data structurally. Do not rely on fragile Regex extractions.
4. **Normalization**: Map the parsed fields into the strictly typed `NormalizedSearchResult` interface expected by the Provider Gateway.
5. **Validation**: Save raw response payloads in your provider's `fixtures/` directory and write Vitest tests to prevent future regressions.
6. **Registration**: Export an Adapter class that implements `BaseAdapter`, instantiate it, and register it in `backend/src/gateway/ProviderGateway.ts` and `public/catalog/providers.json`.
7. **Testing**: Spin up the development server and verify the integration through the developer endpoint `/api/dev/inspect/:id`.

- For a detailed step-by-step guide, see [docs/community/onboarding.md](./docs/community/onboarding.md)
