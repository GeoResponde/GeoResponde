# Provider Investigation: Ayuda en Camino

## Overview
**Provider Name:** Ayuda en Camino (referred to in prompt as juntosVE, likely due to a template copy/paste error)
**Website:** `https://ayudaencamino.com/`
**Purpose:** A real-time coordination platform connecting organizations, collection centers, and donors during the emergency in Venezuela.

## Endpoints Discovered
The platform is a Single Page Application (React) that communicates with a custom backend API (`/api/*`). The following endpoints were discovered by analyzing the frontend bundle:

1. **REST Endpoints**
   - `GET /api/stats`
   - `GET /api/organizations`
   - `GET /api/needs`
   - `GET /api/commitments`
   - `GET /api/flags`
   - `POST /api/organizations/login`
   - `POST /api/organizations/request-password-reset`
   - `POST /api/admin/login`

## Authentication
- **Type:** Session based / Protected via Bearer Token.
- **Details:** Every data-bearing API endpoint (like `/api/organizations` or `/api/needs`) is locked behind authentication and requires a valid JWT sent as a `Bearer` token in the `Authorization` header.
- **Verification:** Live testing of `/api/stats`, `/api/organizations`, and `/api/needs` all returned `401 Unauthorized` responses. The platform strictly enforces access controls.

## Provider Capabilities
Based on the frontend code analysis, the platform supports:
- **Search:** ❌ **Unavailable** publicly. Requires login.
- **Submission:** ❌ **Unavailable** publicly. Requires login.
- **Volunteer / Organization Coordination:** ✅ **Inferred.** The platform has features for "Organizaciones", "Solicitudes" (Needs), and "Compromisos" (Commitments). It also has built-in chat sessions and admin auditing tools.
- **Collection Centers:** ✅ **Inferred.** Supported internally but data is not exposed publicly.
- **Resource Requests:** ✅ **Inferred.** Supported internally but data is not exposed publicly.

## Data Model
- **Entities:** The platform tracks `needs` (Solicitudes), `commitments` (Compromisos), and `organizations` (Organizaciones). 
- **Mapping:** The exact JSON schema is hidden behind the API firewall, but the concepts map cleanly to GeoResponde's `NormalizedSearchResult` (specifically `requests` and `organizations`). However, we cannot access the data to map it.

## Integration Strategy
**No integration is possible at this time.**

The existing Provider Gateway architecture relies on public APIs, open feeds, or authorized API keys. Because `ayudaencamino.com` is a closed, authenticated platform designed exclusively for verified organizations to coordinate internally, we cannot scrape or access their data anonymously.

## Verification
- We verified the public-facing endpoints using `Invoke-WebRequest`.
- All requests for data endpoints strictly returned `401 Unauthorized`.
- We did not attempt to brute force or submit fake data, as the platform is closed.

## Final Recommendation: Option C (Do not integrate at this time)

**Do not integrate.**

### Justification:
Ayuda en Camino (`https://ayudaencamino.com/`) is a closed-loop coordination system for registered NGOs and organizations. It does not expose any public machine-readable data, open APIs, or public search functionality. 

Because all geospatial and humanitarian data is locked behind a strict `401 Unauthorized` authentication layer, an adapter cannot be built using our federated search model. 

If GeoResponde establishes an official partnership with the Ayuda en Camino team in the future and they issue us a dedicated API Key, we can revisit this investigation. Until then, it is technically impossible to integrate without authorized credentials.

## Future Potential: Option D (Federated Needs Discovery)

While currently closed (Option C), Ayuda en Camino is functionally an ideal candidate for **Option D (Federated Needs Discovery)**. 

### What is needed to unlock Option D?
1. **Partnership & Authorization:** We must establish contact with the Ayuda en Camino team and secure explicit permission to access their data.
2. **API Credentials:** They must issue a secure Service Account Token or a static API Key (`Bearer <TOKEN>`) that allows our backend to bypass the `401 Unauthorized` responses on their `/api/needs`, `/api/commitments`, and `/api/organizations` endpoints.
3. **Data Schema Collaboration:** Since their API returns a proprietary JSON structure, we will need them to either provide API documentation or allow us to hit the endpoints with our token to reverse-engineer the schema mapping.

### Why it fits perfectly into Option D:
- Their internal data model inherently tracks exactly the primitives required for a supply/demand match engine: **Needs (Solicitudes)** and **Commitments (Compromisos)**.
- If an adapter were built using a granted API key, it could securely query `/api/needs` and pull verified shelter/hospital requirements directly into GeoResponde's future Federated Needs Discovery pillar, unlocking cross-organization logistics.
