# Centros de Acopio Provider Investigation

**Date**: July 2026
**Provider Name**: Centros de Acopio (acopiovenezuela)
**Website**: https://acopiovenezuela.vercel.app/
**Category**: Volunteer Initiative / Other

## 1. Provider Overview
"Centros de Acopio" is a volunteer-led, crowdsourced directory of collection centers (centros de acopio) across Venezuela, created in response to the emergency. It allows citizens to search for and submit new collection centers, including what supplies they are currently receiving. The platform is hosted on Vercel and uses a Google Sheet as its backend database via the `sheet2api` service.

## 2. Discovered Endpoints
Inspection of the frontend application code revealed the following endpoints:

- **Collection Centers API (GET / POST)**: `https://sheet2api.com/v1/asiBQJjRTh2I/copia-de-centros-de-acopio-terremoto-venezuela`
- **News API**: `https://sheet2api.com/v1/asiBQJjRTh2I/noticias` (Currently returning 404 Not Found, indicating the tab is likely missing or unpublished on the upstream sheet).

## 3. Authentication
- **Public**: Both GET (Search) and POST (Submission) requests to the `sheet2api` endpoints are completely public and unauthenticated. 

## 4. Provider Capabilities
- **Search**: `Experimentally Verified`. The API returns a JSON array of collection centers.
- **Submission**: `Experimentally Verified`. The frontend uses a standard `fetch` POST request to the same API to submit new collection centers and to report invalid ones (updating the `Qué reciben` and `reportado` fields).
- **Volunteer coordination**: `Unavailable`.
- **Collection centers**: `Experimentally Verified`. This is the core dataset of the provider.
- **Resource requests**: `Inferred / Documented`. The dataset contains a "Qué reciben" field, which acts as a declaration of needs for that specific collection center.
- **Donation requests**: `Unavailable`.

## 5. Data Model Mapping
The `sheet2api` JSON response maps cleanly to GeoResponde's `NormalizedSearchResult`:

| Provider Field | GeoResponde Field | Notes |
| :--- | :--- | :--- |
| `Quién` | `title` | Name of the collection center |
| `Qué reciben` | `description` | The specific supplies requested/accepted |
| `Dirección`, `Ciudad `, `País` | `location` | Can be concatenated into a full address string |
| `Contacto` | `metadata.contact` | Contact information |
| `Foto` | `metadata.photo` | Base64 encoded image or "si"/"no" |
| `reportado` | `metadata.reported` | Whether the center has been flagged by users |

**Mapped Resource Type**: `Collection Center`

## 6. Integration Strategy & Limitations
**Search Integration**:
An adapter can easily be implemented to perform a GET request to the `sheet2api` endpoint and map the resulting JSON array into `NormalizedSearchResult` objects. 

**Limitations**:
1. **Undocumented Frontend API**: The `sheet2api` endpoint is an undocumented frontend API consumed by their production application. It is not an officially published developer API.
2. **Rate Limiting & Fragility**: `sheet2api` free tiers have strict rate limits. A sudden influx of traffic from GeoResponde's federated search could exhaust their quota, taking down their website.
3. **Schema Fragility**: Because the backend is a Google Sheet, if the sheet owner renames a column (e.g., from "Qué reciben" to "Insumos"), the API response keys will change, breaking the adapter.
4. **Submission Explicitly Omitted**: Although POST is technically possible, **we intentionally do not implement submission**. Submitting programmatically to an unauthenticated Google Sheet risks introducing spam or exhausting their quota. We must first establish contact with the provider before sending production data.

## 7. Final Recommendation

### **Option A: Integrate as Search Provider**
(and optionally **Option D: Federated Needs Discovery**)

**Reasoning**:
`acopiovenezuela` provides a highly relevant, machine-readable dataset of active collection centers and their specific supply needs. It is fully integrable into our federated architecture as a **Search Provider**. 

Because of the upstream fragility and rate-limiting concerns (Sheet2API quotas), this provider **must use the adapter-level `VolatileTtlCache`**. The adapter should cache the normalized `NormalizedSearchResult[]` array (not the raw JSON) and configure the TTL via the provider configuration (defaulting to 5 minutes) to avoid hugging their API to death during traffic spikes. Submission is strictly excluded to prevent accidental spam or quota exhaustion.
