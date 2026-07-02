# Contributing to GeoResponde

We welcome contributions from developers, researchers, and humanitarian organizations! Please see our guidelines below.

## General Workflow

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## Adding a Provider

Adding a new humanitarian or scientific provider is the most common way to contribute. Please follow this standard workflow to ensure your provider integrates correctly into the architecture:

1. **Investigation**: Inspect the target provider's network traffic. Identify the most robust data endpoint available (e.g. public API, JSON feed, Supabase endpoints, ArcGIS feature services). Avoid web scraping (parsing HTML) unless strictly necessary.
2. **Transport Selection**: Determine if an existing transport in `backend/src/transports/` fits your needs (like `REST` or `Remix Single Fetch`). If not, implement a generic transport client that others can reuse.
3. **Parser**: Create a dedicated `parser.ts` to deserialize and traverse the response data structurally. Do not rely on fragile Regex extractions.
4. **Normalization**: Map the parsed fields into the strictly typed `NormalizedSearchResult` interface expected by the Provider Gateway.
5. **Validation**: Save raw response payloads in your provider's `fixtures/` directory and write Vitest tests to prevent future regressions.
6. **Registration**: Export an Adapter class that implements `BaseAdapter`, instantiate it, and register it in `backend/src/gateway/ProviderGateway.ts` and `public/catalog/providers.json`.
7. **Testing**: Spin up the development server and verify the integration through the developer endpoint `/api/dev/inspect/:id`.

- For a detailed step-by-step guide, see [docs/community/onboarding.md](./docs/community/onboarding.md)