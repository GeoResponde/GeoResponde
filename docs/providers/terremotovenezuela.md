# TerremotoVenezuela Provider Discovery

## Overview

- **API Base URL**: `https://api.terremotovenezuela.com/api/v1/`
- **Documentation URL**: `https://api.terremotovenezuela.com/explorer`
- **Authentication**: None explicitly required for the exposed endpoints (no `security` definitions present in OpenAPI spec).
- **Versioning**: v1
- **Rate limits**: Not specified in the current OpenAPI documentation.
- **CORS**: Expected to be enabled for public consumption, but must be verified during integration.
- **Data format**: JSON (`application/json`)
- **General observations**: The API is currently very tightly scoped around damaged buildings (`edificios`) and reporting damage (`reportes`). It does not appear to expose general endpoints for shelters, hospitals, or general missing persons, although missing persons are somewhat coupled to damaged building reports via `has_missing_persons` and `trapped_names` flags.

---

## Endpoints

### 1. `GET /api/v1/edificios`
- **Description**: Search and retrieve a paginated list of damaged building records.
- **Authentication required**: No
- **Parameters**: 
  - `page` (number, query): For pagination offset.
  - `limit` (number, query): Maximum number of records per page.
  - `name` (string, query): Filter by building name.
  - `city` (string, query): Filter by city.
  - `damage_level` (string, query): Filter by the level of damage.
- **Pagination**: Yes, via `page` and `limit`.
- **Filtering**: Yes, by `name`, `city`, and `damage_level`.
- **Sorting**: Not explicitly exposed in the API parameters.
- **Response structure**: Expected to return an array of building entities.
- **Error responses**: Not explicitly modeled (default 200 is documented).

### 2. `GET /api/v1/edificios/{id}`
- **Description**: Fetch a single damaged building by its UUID.
- **Authentication required**: No
- **Parameters**: 
  - `id` (string, path, required): The UUID of the building.
- **Response structure**: Expected to return a single building entity.

### 3. `GET /api/v1/edificios/{id}/statuses`
- **Description**: Fetch the status timeline or evaluation history for a specific building.
- **Authentication required**: No
- **Parameters**: 
  - `id` (string, path, required): The UUID of the building.
- **Response structure**: Expected to return an array of status timeline events.

### 4. `POST /api/v1/reportes`
- **Description**: Submit a new report for a damaged building or related incident.
- **Authentication required**: No (based on OpenAPI spec), but potentially handled via moderator notes/reviews asynchronously.
- **Request Body**:
  - **Required**: `building_name`, `address`, `city`, `damage_level`
  - **Properties**:
    - `building_name` (string)
    - `address` (string)
    - `city` (string)
    - `zone` (string)
    - `construction_type` (string)
    - `damage_level` (string, enum: `parcial`, `severo`, `total`)
    - `people_trapped` (string, enum: `si`, `no`, `no_se`, default: `no_se`)
    - `description` (string)
    - `media_url` (string)
    - `source` (string)
    - `reporter_name` (string)
    - `reporter_contact` (string)
    - `lat` (number)
    - `lng` (number)
    - `linked_building_id` (string, UUID)
    - `trapped_names` (string)
    - `has_missing_persons` (boolean, default: false)
    - `media_urls` (array of strings, default: [])
    - `reviewed_at` (string, date-time)
    - `reviewed_by` (string, UUID)
    - `moderator_note` (string)
- **Response structure**: Likely returns the created report ID or acknowledgment.

---

## Data Model

### Entities

1. **Building (Edificio)**
   - The primary resource representing a physical structure affected by the event.
   - Contains locational data (`address`, `city`, `zone`, `lat`, `lng`), structural data (`construction_type`), and assessment state (`damage_level`).

2. **Report (Reporte)**
   - The primary submission mechanism. It heavily overlaps with the Building entity but includes submission metadata (`reporter_name`, `reporter_contact`, `source`, `media_urls`).
   - Includes moderation fields (`reviewed_at`, `reviewed_by`, `moderator_note`).
   - Couples human impact data (`people_trapped`, `trapped_names`, `has_missing_persons`) directly into the building report.
   - **Relationship**: Can be linked to an existing building via `linked_building_id`.

3. **Status Timeline (BuildingStatusTimeline)**
   - Tracks historical status updates for an `Edificio`.
   - **Relationship**: Belongs to a Building.

---

## Capabilities

- [x] **Search**: Yes, via `/api/v1/edificios` using query parameters (`name`, `city`, `damage_level`).
- [x] **Read operations**: Yes, fetching specific buildings and their status timelines.
- [x] **Report submission**: Yes, via POST `/api/v1/reportes`.
- [ ] **Update operations**: No direct PUT/PATCH endpoints exposed publicly for resources. Updates are likely handled internally via the admin dashboard upon reviewing reports.
- [x] **Attachments**: Yes, `media_url` and `media_urls` arrays for image/video links.
- [x] **Geographic information**: Yes, `lat`, `lng`, `address`, `city`, `zone`.
- [x] **Images**: Handled as external string URLs (`media_urls`).
- [x] **Coordinates**: Handled as numeric `lat`, `lng`.
- [x] **Metadata**: Handled via `source`, `reporter_name`, `reporter_contact`.
- [x] **Status tracking**: Yes, via `/api/v1/edificios/{id}/statuses`.

---

## Mapping to GeoResponde

- **Find (Humanitarian Network)**
  - The `GET /api/v1/edificios` endpoint maps directly to the **Find** module for searching damaged buildings.
  - GeoResponde users searching for specific buildings (by name or city) will federate queries to this API.
  - While TerremotoVenezuela tracks missing/trapped persons as text fields within a building (`trapped_names`, `has_missing_persons`), GeoResponde could potentially index these as "associated risks" when rendering the building result.

- **Report (Operations)**
  - The `POST /api/v1/reportes` endpoint aligns perfectly with GeoResponde's **Report** module.
  - GeoResponde's "Damaged Building" report form can be mapped strictly to the TerremotoVenezuela POST payload, ensuring reports submitted via GeoResponde are ingested natively by TerremotoVenezuela.

- **Situation (Scientific Intelligence)**
  - Aggregated building damage levels could technically be visualized as a heat map layer in the **Situation** module, although paginated REST APIs are less optimal for mass geospatial point mapping compared to GeoJSON endpoints.

---

## Search Strategy

### Workflow
1. A user enters a query in GeoResponde (e.g., "Residencias San Martin" or city "Caracas").
2. GeoResponde translates this into a live query: `GET /api/v1/edificios?name=Residencias San Martin&city=Caracas`.
3. GeoResponde fetches the response and normalizes the `Edificio` objects into GeoResponde's unified schema.
4. GeoResponde displays the results natively, badging them with the TerremotoVenezuela provider source.
5. Users can view the normalized result, or click "Open Original Resource" to be directed to TerremotoVenezuela's platform if a public frontend URL structure is available (e.g., `https://terremotovenezuela.com/edificio/{id}`).

### Limitations
- **No Global Text Search**: The API requires explicit query filtering by `name`, `city`, or `damage_level`. There is no single `?q=` full-text search parameter, which means GeoResponde's federated search must intelligently map user inputs to specific API fields (e.g., guessing if the input is a city or a building name).
- **Missing Persons are not First-Class Entities**: A user searching for a missing person by name via GeoResponde will NOT find them through this API because `trapped_names` is a text field within a building and is not exposed as a searchable query parameter.

---

## Reporting Strategy

### Workflow
- GeoResponde hosts a "Report Damaged Building" form in its Report module.
- The form collects: Building Name, City, Address, Damage Level (Required).
- Upon submission, GeoResponde performs a `POST /api/v1/reportes` request behind the scenes.
- **Required fields**: `building_name`, `address`, `city`, `damage_level`.
- **Validation**: GeoResponde must enforce the strict ENUMs (`damage_level`: `parcial`, `severo`, `total` and `people_trapped`: `si`, `no`, `no_se`).
- **Challenges**: 
  - Media uploading: TerremotoVenezuela expects URL strings (`media_url`, `media_urls`). GeoResponde would need its own intermediary media upload bucket, or TerremotoVenezuela would need to provide an S3/presigned-url upload endpoint.
  - The `POST` endpoint accepts moderation fields (`reviewed_by`, `moderator_note`). GeoResponde should omit these to avoid polluting the payload.

---

## Provider Evaluation

### Strengths
- **Clean and Focused**: The API is incredibly focused on its core domain (buildings and structural reports).
- **Enums**: The use of explicit enumerations (`damage_level`, `people_trapped`) ensures data hygiene and makes normalization into GeoResponde very predictable.
- **Status Timelines**: Exposing the history of a building's evaluation (`statuses`) is an excellent operational feature for transparency.

### Weaknesses
- **Search Flexibility**: The lack of a unified `?q=` search parameter limits broad federated discovery.
- **Entity Coupling**: Coupling human impacts (`trapped_names`, `has_missing_persons`) directly into building payloads limits the ability to track individuals independently.
- **Geospatial Queries**: No bounding box (`bbox`) or radius search parameters are provided, making map-based discovery difficult.

---

## Future Collaboration

Observations to discuss with the TerremotoVenezuela team for future API iterations:

1. **Full-Text Search Endpoint**: A generic `?q=` query parameter that searches across building names, addresses, and cities simultaneously.
2. **Geospatial Search**: Adding `?lat=X&lng=Y&radius=Z` or `?bbox=...` to allow map-based queries. This would allow GeoResponde to automatically fetch buildings in the user's current map view.
3. **Missing Persons Index**: Exposing an endpoint to search specifically through `trapped_names` so that families searching for individuals can discover if they are registered as trapped in a specific building.
4. **GeoJSON Export**: An endpoint like `GET /api/v1/edificios/geojson` that returns a lightweight GeoJSON feature collection of all buildings (without pagination). This would allow platforms like GeoResponde to easily render the entire damage dataset on the Situation map layer.
5. **Standardized Media Uploads**: Guidance or endpoints for handling multipart/form-data image uploads, rather than relying on external URL strings.
