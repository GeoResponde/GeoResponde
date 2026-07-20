# Provider Investigation: Voluntarios Terremoto Vzla

## Overview
**Provider Name:** Brigada de Voluntarios Independientes – Venezuela (Voluntarios Terremoto Vzla)
**Website:** `https://voluntariosterremotovzla.org`
**Purpose:** A volunteer coordination platform designed to channel independent volunteers and resources (skills, vehicles, Starlink) to areas of impact following the earthquake, without duplicating efforts.

## Endpoints Discovered

1. **`GET /edan.html`**
   - **Type:** Static HTML.
   - **Contents:** Summarizes UN reports (OPS, UNICEF, OCHA) regarding needs in the field (talent and resources).
   - **Machine-readable:** No.

2. **`GET /refugios.html`**
   - **Type:** Static HTML.
   - **Contents:** Hardcoded list of 5 relocated shelter sites in Caracas (e.g., Coliseo de La Urbina, Escuela Técnica Mariano Picón Salas).
   - **Machine-readable:** No. Requires HTML scraping to extract data.

3. **`POST /.netlify/functions/inscribir`**
   - **Type:** REST API endpoint.
   - **Authentication:** Public (unauthenticated submission).
   - **Purpose:** Receives volunteer registration form payloads and persists them to a Supabase database.
   - **Observed Payload (Inferred from frontend JS):**
     ```json
     {
       "nombre": "String",
       "cedula": "String",
       "email": "String",
       "tel": "String",
       "em": "String", // Emergency contact
       "hab": ["String"], // Skills/Abilities (e.g., "Vehículo: rústico")
       "form": "String", // Certifications joined by ' — '
       "hb": "String", // Other skills
       "estado": "pendiente"
     }
     ```

## Authentication
- Registration (`/inscribe.html`) is **Public**.
- Volunteer portal access (`/equipo.html` / `/login`) is **Protected** (via Supabase authentication tokens stored in localStorage).

## Provider Capabilities
- **Search (People/Shelters):** ❌ **Unavailable.** Shelters are listed in static HTML, not searchable via an API.
- **Submission (Reports):** ❌ **Unavailable.** 
- **Volunteer Coordination:** ✅ **Experimentally verified.** The platform registers and verifies volunteers to deploy them.
- **Resource Requests:** ✅ **Documented.** The `edan.html` page lists human talent and supply needs, but purely as static text.

## Data Model
- **Shelters:** Present as static HTML `<article>` blocks. Not normalized into JSON.
- **Volunteers:** Submitted as a JSON object, but GeoResponde currently does not have a `volunteer` normalized data model or a `volunteer-registration` topic.

## Integration Strategy
An adapter using the existing Provider Gateway architecture cannot be implemented for search because there are no machine-readable JSON feeds, GraphQL endpoints, or REST APIs to query shelters or missing persons. Scraping static HTML violates the integration architecture guidelines for robustness.

Submission integration into `/.netlify/functions/inscribir` is technically possible. However, GeoResponde currently lacks a "Volunteer Registration" form topic (`REPORT_TOPICS`). Furthermore, federating volunteer registrations involves sending PII (cédula, email, phone) to a third-party Supabase instance, which would require strict consent flows.

## Verification
- **Submission:** We examined the `inscribe.html` frontend code to infer the JSON payload and validation logic. We did not submit a fake report to avoid polluting their coordination database.
- **Search:** No endpoints to test.

## Final Recommendation: Option D (Federated Needs Discovery)

**Do not integrate at this time (Option C), but keep open for Option D.**

### Justification:
The provider lacks machine-readable APIs for our current core capabilities (Federated Search for missing persons, collection centers, or shelters). 

However, as discussed in Issue #147, the response ecosystem is evolving from "search" to "coordination" and "resource matching". Voluntarios Terremoto Vzla represents the "Supply" side (volunteers) and documents the "Demand" side (EDAN needs). 

If GeoResponde expands into **Option D: Federated Needs Discovery** (federating published needs and volunteer offers into a single discovery layer), this platform would be a prime integration partner. Until that architectural decision is made and the `volunteer-registration` topic is introduced, this provider remains out of scope for the current v0.5 architecture.
