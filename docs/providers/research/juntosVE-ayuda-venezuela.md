# Provider Investigation: juntosVE

## Overview
**Provider Name:** juntosVE
**Website:** `https://juntosve.org/`
**Purpose:** A progressive web app (PWA) and map for reporting and finding needs after the earthquake (rescues, medical, water, food, shelters). It is designed to work offline.

## Endpoints Discovered

1. **Supabase PostgREST API**
   - **Base URL:** `https://zczxcjcdvhjgnoqxnlal.supabase.co/rest/v1/`
   - **Table:** `/points`
   - **Type:** REST (PostgREST)
   - **Machine-readable:** Yes (JSON & GeoJSON).

## Authentication
- **Type:** API Key / Bearer Token.
- **Details:** The frontend uses a public Supabase `anon` key.
  - Header: `apikey: <anon_key>`
  - Header: `Authorization: Bearer <anon_key>`

## Provider Capabilities
- **Search:** ✅ **Experimentally verified.** The `/points` table can be queried directly via PostgREST.
- **Submission:** ✅ **Inferred.** The frontend has a `/reportar` route which likely performs a `POST` to the `/points` table using the `anon` key, subject to Row Level Security (RLS) policies.
- **Volunteer Coordination:** ❌ **Unavailable** publicly. Volunteer/responder dashboards exist (`/responder`, `/moderar`) but are protected by Supabase Auth.
- **Collection Centers / Shelters:** ✅ **Experimentally verified.** Stored as points with `type = 'refugio'`.
- **Resource Requests / Incidents:** ✅ **Experimentally verified.** Stored as points with `type = 'rescate'`, `'comida'`, `'otro'`.
- **Missing Persons:** ❌ **Unavailable.** Missing persons (`desaparecido`) are explicitly filtered out in the frontend code and were not found in the DB.

## Data Model

The provider uses a single `points` table to store all geospatial entities.

**Raw Schema:**
```json
{
  "id": "uuid",
  "type": "rescate | refugio | comida | otro",
  "status": "resuelto | activo | pendiente",
  "location": "WKB (Well-Known Binary) Point",
  "description": "string | null",
  "photo_url": "string | null",
  "people_count": "integer | null",
  "capacity": "integer | null",
  "spots_available": "integer | null",
  "accepts": "string | null",
  "report_token_hash": "string",
  "created_by_ip": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "resolved_at": "timestamp | null",
  "verified": "boolean"
}
```

**Mapping to GeoResponde:**
- **Entity:** `CollectionCenter` (for `refugio`) or `Report` (for `rescate`/`comida`).
- **Location:** If we pass `Accept: application/geo+json` in the HTTP header, PostgREST automatically converts the `location` field into a valid GeoJSON Feature!
  - `geometry.coordinates` -> `[lng, lat]`
- **Status:** `activo` -> `active`, `resuelto` -> `inactive`.
- **Metadata:** `capacity`, `spots_available`, `accepts` map perfectly into `CollectionCenter` metadata.

## Integration Strategy

An adapter can be seamlessly implemented using our existing Provider Gateway architecture.

**Search Implementation:**
1. Use `fetchJson` to `GET https://zczxcjcdvhjgnoqxnlal.supabase.co/rest/v1/points`.
2. Append `?type=eq.refugio` or `?type=eq.rescate` to filter by type.
3. Pass headers: 
   - `apikey`: `<anon_key>`
   - `Authorization`: `Bearer <anon_key>`
   - `Accept`: `application/geo+json` (Crucial for getting GeoJSON instead of WKB).
4. Map the resulting GeoJSON Features to `NormalizedSearchResult[]`.

**Submission Implementation:**
Submission is technically possible via `POST /points` but relies on strict Supabase RLS policies (requiring `report_token_hash` and `created_by_ip`). Reverse-engineering this is brittle and not recommended for the initial integration.

## Verification
- We verified the Search endpoint by performing a live `GET /points?limit=1` request with the `application/geo+json` Accept header. The server successfully returned a GeoJSON FeatureCollection.
- Submission was not tested to avoid polluting their database with fake reports.

## Final Recommendation: Option A (Integrate as Search Provider)

**Integrate as Search Provider.**

### Justification:
juntosVE exposes a pristine, machine-readable Supabase PostgREST API that can natively output GeoJSON. The mapping to our `NormalizedSearchResult` for Shelters/Collection Centers is highly compatible. 

We should start by implementing a `JuntosVeAdapter` that queries their `/points` table for `refugio` types and integrates them into our Federated Search UI. Submission should be deferred until we have a formal partnership or API sandbox.

## Final Notes
- The upstream is classified as: **Official frontend API (undocumented)**
- The adapter has been fully integrated into the backend and registered as `JuntosVeAdapter`.
- GeoJSON pagination helper was implemented in the shared transport.
