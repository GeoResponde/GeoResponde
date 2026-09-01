# Provider Integration Guide

The **Provider Gateway** is the core architecture in GeoResponde responsible for federating requests to disparate humanitarian databases and APIs. 

## Supported Transports

GeoResponde is designed to interface with systems as they exist in the wild. While a REST API is preferred, the framework supports a variety of fallback transports to integrate with real-world providers.

Currently Supported Transports:
- `REST` (JSON Endpoints)
- `Remix Single Fetch` (TurboStream Deserialization)
- `ArcGIS Feature Services`
- `Supabase PostgREST`

## Provider Documentation Lifecycle

Provider-related docs live in three tiers, in the order a provider actually
moves through them. Knowing which tier a document belongs to prevents
mistaking a research note for an implementation guide (or vice versa):

1. **Discovery / research** — `docs/providers/research/`. Notes from
   investigating a candidate provider's API: base URL, auth, rate limits,
   data shape, open questions. Describes what the provider looks like from
   the outside. Not code, not a build guide — a provider can sit here
   indefinitely before anyone implements it.
2. **Implementation** — [`docs/providers/provider-integration-template.md`](./providers/provider-integration-template.md)
   is the canonical, single guide for turning a researched provider into a
   working adapter (folder structure, `BaseAdapter` contract, parser rules,
   fixtures, registration, PR checklist). `CONTRIBUTING.md`'s "Adding a
   Provider" section is the short version that points here.
3. **Operational** — [`docs/providers/submission-matrix.md`](./providers/submission-matrix.md)
   (which providers accept which report topics, live-readiness) and
   [`docs/providers/testing-checklist.md`](./providers/testing-checklist.md)
   (pre-PR self-check) describe the fleet of already-integrated providers,
   not how to build a new one.

If you're reading a doc under `docs/providers/research/` and it reads like
step-by-step build instructions, or the reverse, that's a sign it's
mis-filed — flag it.

## Current Providers

Because the list of active integrations changes frequently, we no longer maintain a hardcoded table in this document.

Instead, you can view the active fleet of integrations directly within the application:
1. **[Public Provider Registry](/providers)**: Shows all active organizations and their search capabilities.
2. **[Developer Health Dashboard](/dev/providers)**: Shows real-time telemetry, including adapter uptime, data freshness metrics, and latency history for every active provider.

*Note: The system dynamically loads provider configurations from the internal catalog.*
