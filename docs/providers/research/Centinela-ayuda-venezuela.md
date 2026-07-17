# Centinela Provider Investigation

**Date**: July 2026
**Provider Name**: App Centinela
**Website**: https://app.appcentinela.com/instalar
**Category**: Emergency Alerts, Civil Protection, News Aggregation

## 1. Provider Overview
App Centinela is a React-based Single Page Application (SPA) backed by Firebase. Its stated purpose is providing "Inteligencia ciudadana en tiempo real" (Real-time citizen intelligence) through a map of incidents, verified news, and a risk index.

## 2. Discovered Endpoints
The application uses Firebase Firestore as its primary backend. We extracted the Firebase configuration from the application's client-side bundles:

- **Project ID**: `centinela-614f7`
- **Database**: Firestore (`(default)`)
- **API Key**: `AIzaSyDaRHqm3I23pindu9iQg5Me643bCgTZ-bc`

By interacting with the Firestore REST API, we discovered the following collections:

1. **`incidents`**: 
   - **Status**: Publicly accessible (`200 OK`).
   - **Contents**: Events of political violence and protests.
   - **Data Origin**: Every inspected record explicitly marks its `source` as `"ACLED-HDX"` and `description` as `"Evento de violencia política registrado - ACLED"`.

2. **`news`**: 
   - **Status**: Publicly accessible (`200 OK`).
   - **Contents**: Geolocated general news articles scraped from Venezuelan news portals (e.g., La Patilla, El Tiempo VE). Topics range from protests to general interest (e.g., "Caimán en piscina olímpica").

3. **`users`, `reports`, `alerts`, `markers`, `eventos`, `riesgo`, `risk`**:
   - **Status**: Protected / Unavailable (`403 Permission Denied` or non-existent).

## 3. Authentication
- **Public access**: The Firebase Anon/Web API key is public and allows direct read access to the `incidents` and `news` collections via the Firestore REST API.
- No session or OAuth token is required to read these collections.

## 4. Capabilities
- **Search**: `Feasible`. We can retrieve incidents and news using the Firestore REST API.
- **Submission**: `Unavailable`. There is no evidence of public-facing submission endpoints for missing persons, shelters, or resources.
- **Volunteer coordination**: `Unavailable`.
- **Collection centers**: `Unavailable`.
- **Resource/Donation requests**: `Unavailable`.

## 5. Data Model Mapping
The data provided by Centinela does not align with GeoResponde's core humanitarian models:
- **People / Shelters / Hospitals / Collection Centers**: Not present.
- **Incidents**: The `incidents` collection maps to GeoResponde's `hazard` or `other` types. However, this data is entirely imported from ACLED (Armed Conflict Location & Event Data Project) via HDX (Humanitarian Data Exchange). 

## 6. Integration Strategy & Limitations
While building a search adapter using the `fetchJson` transport to query the Firestore REST API is technically trivial, it violates our core architectural principles:

1. **Redundancy**: GeoResponde already has a dedicated, native `HdxAdapter`. Integrating Centinela to fetch ACLED-HDX data would just create a redundant proxy to data we already have access to via the official source.
2. **Out of Scope**: The `news` collection contains scraped general news and political events, which falls outside the scope of GeoResponde's emergency response and missing persons mandate.
3. **No Novel Humanitarian Data**: The application does not crowdsource or host unique data regarding shelters, rescues, or collection centers.

## 7. Final Recommendation

### **Option C: Do not integrate at this time.**

**Reasoning**:
Although Centinela exposes a public, machine-readable API (Firestore), it does not provide any novel humanitarian data. Its `incidents` data is a mirror of ACLED-HDX (which GeoResponde already integrates directly), and its `news` data is out of scope for our platform. 

Integrating this provider would add adapter maintenance overhead without bringing any new, actionable intelligence to rescue workers or citizens.
