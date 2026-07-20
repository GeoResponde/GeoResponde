# Provider Definition of Done (DoD)

This document serves as the canonical checklist for all new humanitarian provider integrations in GeoResponde. Every provider integration PR must satisfy this Definition of Done before it can be reviewed and merged.

## Research and Planning

- [ ] **License compatible**: The source's terms of use permit federating its data. Any relevant nuances are documented.
- [ ] **Research completed**: A comprehensive research document (`docs/providers/research/[provider-name].md`) exists, detailing discovered endpoints, schemas, and authentication methods.
- [ ] **Provider classification**: The provider is clearly classified as Search-only, Submission-capable, or both.
- [ ] **Architecture compliance**: The integration preserves the federated architecture. It does not introduce local databases, synchronization jobs, scheduled imports, or caching mechanisms.

## Implementation

- [ ] **Provider Template completed**: The adapter uses the standard file structure (`adapter.ts`, `parser.ts`, `types.ts`, `fixtures/`, `__tests__/`).
- [ ] **Adapter implemented**: The adapter correctly extends `BaseAdapter` and integrates exclusively through the Provider Gateway. No custom routes are used.
- [ ] **Shared Transport used**: The adapter relies on shared transport helpers (e.g., `getJson`) rather than implementing bespoke HTTP clients unless absolutely necessary.
- [ ] **Parser implemented**: The parser correctly normalizes raw provider records into `NormalizedSearchResult` instances before any filtering takes place.
- [ ] **Types implemented**: TypeScript interfaces exist for all parsed provider payloads.

## Reusability (If Applicable)

- [ ] **Provider SDK updated**: If new reusable infrastructure (caching, shared transports, new generic utilities, pagination helpers, OAuth flows) was introduced, it is documented in the canonical **Provider SDK** (`docs/providers/provider-sdk.md`) so future integrations can reuse the exact same pattern before the PR is considered complete.

## Testing

- [ ] **Synthetic fixtures**: The `fixtures/` directory contains raw response payloads. They contain **no real personal data**: names, IDs, phone numbers, and addresses must be synthetic or redacted.
- [ ] **Unit tests**: `parser.test.ts` and `adapter.test.ts` provide coverage for successful searches, empty responses, malformed responses, and pagination behavior (if applicable).

## Configuration and Catalog

- [ ] **Attribution given**: The provider's `display_name` and `website` are correct and complete, ensuring traceability back to the source.
- [ ] **Links validated**: Provider and per-result links resolve properly.
- [ ] **Catalog updated**: The provider and its organization are correctly registered in `providers.yaml` and `organizations.yaml`. Provider configuration (like URLs and API keys) is declarative and not hardcoded in the adapter.
- [ ] **Catalog validation**: `pnpm catalog:build` runs successfully and validates against the schemas.

## Verification

- [ ] **Documentation updated**: The research document (`docs/providers/research/[provider].md`) reflects the final integration strategy and actual capabilities built.
- [ ] **Federated Search UI verification**: The provider's results appear correctly in the search UI alongside other providers.
- [ ] **Provider Health Dashboard verification**: The provider registers on `/dev/providers` (the health dashboard), which is also aliased via a redirect from `/dev/health`), and displays correct status (not stuck in "warming up" or erroring on first probe).
- [ ] **Live search works**: The search functionality is spot-checked live (e.g. through `GET /api/dev/inspect/:id`) to ensure it returns actual results and doesn't silently fail.
- [ ] **Failure isolation verification**: A failure or timeout in this provider does not crash the Provider Gateway or block other providers.
- [ ] **Production inspection**: Ensure that no submission workflows were implemented unless explicitly authorized by the provider.

## PR Readiness

- [ ] **PR description**: The pull request description links to the research document and clearly states the integration scope.
- [ ] **CI Pipeline**: All automated tests, linters, and type checks pass.
