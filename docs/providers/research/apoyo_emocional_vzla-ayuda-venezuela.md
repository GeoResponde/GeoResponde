# Provider Investigation: Apoyo Emocional Vzla

## Overview
**Provider Name:** Apoyo Emocional Vzla
**Website:** [https://www.apoyoemocionalvzla.com/](https://www.apoyoemocionalvzla.com/)
**Primary Function:** Directory of volunteer mental health specialists for people affected by the 2026 earthquakes in Venezuela.

This investigation was performed to determine whether `Apoyo Emocional Vzla` can be integrated into GeoResponde while preserving a federated architecture.

## Objectives Review
- [x] Endpoint Discovery
- [x] Search Integration Feasibility
- [x] Submission Integration Feasibility

---

## 1. Endpoint Discovery

### Architecture
The site is built on **WordPress** using **Elementor** and **JetEngine** (by Crocoblock). 
- It uses a Custom Post Type (CPT) called `especialistas`.
- Frontend grid rendering is handled server-side (classic WordPress/Elementor template) via JetEngine Listing Grids, which outputs the data directly into HTML on the `/necesito-ayuda/` page.

### Available APIs
1. **WordPress REST API (`/wp-json/wp/v2/`)**
   - The CPT is exposed at `/wp-json/wp/v2/especialistas`.
   - **Limitation:** The REST API response contains the standard fields (Title, Content) and some JetEngine meta (`foto`, `documentos`), but critically **lacks contact information** (WhatsApp numbers, email) and specialty taxonomies in the raw JSON payload, as these were not registered to `show_in_rest`.

2. **Frontend HTML Scraping (`/necesito-ayuda/`)**
   - We verified that the `/necesito-ayuda/` page contains the full server-rendered grid of specialists.
   - Parsing the DOM reveals all the necessary structured data: Name, Specialty/Focus (e.g. "Ansiedad", "Depresión"), and `wa.me/` WhatsApp links.

### Security & CORS
- The REST API endpoint does **not** send `Access-Control-Allow-Origin: *`.
- This means client-side (browser) direct queries from a GeoResponde frontend domain will fail due to CORS.

---

## 2. Integration Feasibility

### Federated Needs Discovery (Fourth Pillar - Option D)
**Outcome:** ⏳ Integration deferred to the Fourth Pillar.

**Implementation Strategy:**
We will **not** incorporate this provider into the primary federated search at this time. Instead, we will incorporate it into the **Fourth Pillar: Federated Needs (Option D)** in the future.

When that phase is implemented, integration will fit perfectly within our **Gateway/Adapter Architecture**. Due to the CORS restriction and the missing contact fields in the REST JSON, a pure client-side federated fetch is impossible. 

An adapter (e.g., `backend/src/adapters/apoyo_emocional/`) would need to be created to:
1. Make a server-side `GET` request to `https://www.apoyoemocionalvzla.com/necesito-ayuda/`.
2. Parse the HTML DOM (using Cheerio) to extract `.jet-listing-grid__item` blocks or just search for the provider text blocks containing `wa.me` links.
3. Map the extracted fields (Name, Specialties, WhatsApp Number) into GeoResponde's standard `Provider` / `Need` schema.
4. Serve the normalized data via the GeoResponde backend API to the frontend.

Alternatively, if we establish contact with the provider admins, they could easily expose the contact fields to the REST API and enable CORS, allowing a more robust JSON-based integration. But the HTML scraping fallback is 100% viable today.

### Submission Integration
**Outcome:** ❌ Submission integration is not recommended at this time (Feasible but brittle).

**Reasoning:**
- Submissions (both for patients requesting direct assignment and for new psychologists registering) are handled via **JetFormBuilder**.
- While we can see the JetFormBuilder API endpoints (`/wp-json/jet-form-builder/v1/`), submitting data to them programmatically requires matching exact nonce tokens, form schemas, and handling potential CAPTCHA/anti-spam protections. 
- It is much more robust to integrate them as a **Search Provider**, where GeoResponde users simply discover the specialist and click the WhatsApp link to initiate contact directly, preserving the provider's existing workflow.

---

## Conclusion

**Final Verdict:** ⏳ Integration deferred to the Fourth Pillar: Federated Needs (Option D).

We will not proceed with a standard federated search integration. Instead, this provider is bookmarked for future incorporation into the Federated Needs discovery feature.
