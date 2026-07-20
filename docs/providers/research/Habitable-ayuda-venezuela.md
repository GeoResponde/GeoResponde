# Provider Investigation: Habitable

## 1. Provider Overview
**Name**: HABITABLE
**URL**: https://habitable.gob.ve/
**Purpose**: An offline-first Progressive Web App (PWA) designed for citizens and official inspectors to perform rapid self-assessments of housing habitability following an earthquake.
**Methodology**: It employs a green/yellow/red traffic light system based on the FUNVIS / ATC-20 post-earthquake damage assessment methodology. 
**Developer**: revolut.team (as per the JSON-LD schema metadata on the site).

## 2. Endpoint Discovery
An exhaustive inspection of the live application and its minified JavaScript bundle (Vite/React) was conducted to discover potential integration points.

**Discovered Endpoints:**
- `https://habitable.gob.ve` (Web App Root)
- `"/api/v1"` (Fragment found in the source, suggesting a backend REST API relative to the origin).
- **No public data feeds** (GeoJSON, STAC, CSV, RSS) were discovered.
- **No GraphQL, Firebase, or Supabase** URLs were found in the client configuration.

## 3. Authentication
- **Protected / Session Based**: The frontend code contains registration and login flows. The application explicitly states: *"Ahora estás en proceso de validación por parte del ente encargado. Cuando te asignen a una institución podrás comenzar a trabajar."* 
- This indicates the system relies on an official credentialing process for inspectors before data submission or synchronization is permitted. 

## 4. Provider Capabilities
- **Search (Unavailable)**: There is no public interface or API to search, browse, or export the submitted building assessments.
- **Submission (Protected)**: The application supports census/assessment submissions, storing them locally (IndexedDB/LocalStorage) and marking them as `Pendiente`, `Sincronizado`, or `Rechazado`. Submissions sync to the backend when online, but the endpoint requires an authenticated session.
- **Volunteer coordination (Unavailable)**
- **Collection centers (Unavailable)**
- **Resource requests (Unavailable)**

## 5. Data Model
While we cannot access the API, the frontend payload structures imply the following data model exists internally:
- **Buildings/Censos**: Contains `nombreEdificacion`, `direccion`, `estado`, `municipio`, `tipoVivienda`.
- **People (Personas)**: Linked to censuses. Contains `nombre`, `apellido`, `cedula`, `fechaNacimiento`, `sexo`.
- **Status**: Traffic light (Green/Yellow/Red) derived from the ATC-20 survey logic.

## 6. Integration Strategy
An adapter **cannot** be implemented using our existing Provider Gateway architecture at this time. 
- The gateway requires either a public read endpoint (for Search) or a documented, API-key accessible write endpoint (for Submission).
- `habitable.gob.ve` exposes neither. It functions as a closed, institutional data collection silo.

## 7. Final Recommendation

**Option C: Do not integrate at this time.**

**Reasoning:**
HABITABLE is a highly specialized, closed-loop government application. It does not provide any public machine-readable endpoints, open data feeds, or third-party developer APIs. Furthermore, the submission pipeline is tightly coupled to an internal user validation process ("asignación a una institución"), making it impossible for GeoResponde to act as an anonymous or federated submission partner without explicit institutional integration (e.g., being issued a service account or OAuth credentials by the administrators). 

Unless a Memorandum of Understanding is established to open a server-to-server API bridge, this provider is not technically integrable.
