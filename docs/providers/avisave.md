# Avisave Provider Discovery

## Overview

- **API Base URL**: `https://avisave.com/api/public/`

- **OpenAPI URL**: `https://api.avisave.com/api/public/openapi.json`

- **Authentication**: None required. Public no-key API for external developers, search tools, civic responders, and agents.

- **Versioning**: v1

- **Rate limits**: Yes, enforced with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Production requests require Redis configuration.

- **CORS**: Expected to be enabled for public consumption.

- **Data format**: JSON (`application/json`)

- **General observations**: The API is focused on public disaster incident summaries with minor personal data redaction. Evidence media is restricted from public responses. It provides semantic search capabilities across incident data and supports filtering by category, severity, and verification status.


## Endpoints

### 1. `GET /`

- **Description**: Get public API discovery metadata.

- **Authentication required**: No

- **Operation ID**: `getPublicApiIndex`

- **Tags**: Discovery

- **Parameters**: None

- **Response structure**: Returns `PublicApiIndex` object containing name, version, description, authentication info, OpenAPI URL, endpoints list, rate limit configuration, and cache settings.

- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

- **Error responses**:

  - `429` - Rate limit exceeded (includes `Retry-After` header)

  - `503` - Rate limiting unavailable (Redis not configured)

### 2. `GET /openapi.json`

- **Description**: Get the OpenAPI 3.1 schema for the public API. Use this endpoint to let external developers, search systems, and agents map the public API.

- **Authentication required**: No

- **Operation ID**: `getPublicOpenApiSpec`

- **Tags**: Discovery

- **Parameters**: None

- **Response structure**: Returns the complete OpenAPI 3.1 specification as a JSON object.

- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

- **Error responses**:

  - `429` - Rate limit exceeded (includes `Retry-After` header)

  - `503` - Rate limiting unavailable (Redis not configured)

### 3. `GET /incidents`

- **Description**: List and search public incident summaries. Returns public incident summaries with minor personal data redacted. Use search before submitting a new report to find existing missing-person reports, hospital rosters, shelters, support centers, road issues, supplies, and other incident information.

- **Authentication required**: No

- **Operation ID**: `listIncidentSummaries`

- **Tags**: Incidents

- **Pagination**: Yes, via `offset` and `limit` parameters.

- **Parameters**:

  - `locale` (string, query, optional): Response locale. Supported values: `es`, `en`. Default: `es`

  - `limit` (integer, query, optional): Maximum number of summaries to return. Range: 1-50. Default: 20

  - `offset` (integer, query, optional): Zero-based pagination offset. Range: 0-10000. Default: 0

  - `search` (string, query, optional): Public-safe keyword and semantic search across incident titles, summaries, locations, names, and public evidence labels/summaries. Raw source text, media transcripts, and raw-evidence vector matches are excluded.

  - `filter` (string, query, optional): Convenience filter matching category or severity.

  - `category` (string, query, optional): Incident category filter. Enum: `Critical`, `Collapsed`, `Missing`, `Rescued`, `Medical`, `Roads`, `Shelters`, `Utilities`, `Supplies`

  - `severity` (string, query, optional): Incident severity filter. Enum: `Critical`, `High`, `Medium`, `Resolved`

  - `verification` (string, query, optional): Verification status filter. Enum: `VERIFIED`, `VERIFYING`, `NEEDS REVIEW`

- **Response structure**: Returns `PublicIncidentSummariesResponse` containing:

  - `data`: Array of `PublicIncidentSummary` objects

  - `pagination`: `Pagination` object with `limit`, `offset`, `nextOffset`

  - `meta`: `PublicApiMeta` object with `generatedAt` and `cacheTtlSeconds`

- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

- **Error responses**:

  - `429` - Rate limit exceeded (includes `Retry-After` header)

  - `503` - Rate limiting unavailable (Redis not configured)


## Data Model

### Entities

1. **PublicApiIndex**

   - The root API discovery object.

   - Contains metadata about the API including name, version, description, authentication requirements, OpenAPI URL, available endpoints, rate limits, and cache configuration.

2. **PublicApiEndpoint**

   - Represents a single endpoint in the API discovery.

   - Properties: `method` (GET only for public API), `path`, `operationId`, `description`.

3. **PublicApiRateLimit**

   - Rate limiting configuration for the public API.

   - Properties: `maxRequests`, `windowSeconds`, `headers` (array of header names).

4. **PublicIncidentSummariesResponse**

   - The response wrapper for incident list queries.

   - Contains `data` (array of incident summaries), `pagination`, and `meta`.

5. **PublicIncidentSummary**

   - The primary resource representing a disaster incident summary.

   - Contains:

     - Identification: `id`, `url`

     - Categorization: `category`, `lifecycle`, `severity`, `verification`, `confidence`

     - Content: `title`, `summary`

     - Impact: `estimatedVictims`, `recommendedAction`, `actionPriority`

     - Location: `location` (IncidentLocation object)

     - Timing: `observedAt`, `relativeTimeLabel`, `createdAt`, `updatedAt`

     - Relationships: `latestTimelineEvent`, `linkedIncidentIds`

     - Evidence: `evidence` (array of PublicIncidentEvidence), `evidenceRestriction`

     - Validation: `validation` (IncidentValidation)

6. **IncidentLocation**

   - Geographic information for an incident.

   - Properties: `label`, `locality`, `region`, `countryCode`, `latitude`, `longitude`, `precisionMeters`.

7. **PublicIncidentEvidence**

   - Evidence associated with an incident (media, reports, etc.).

   - Properties: `kind`, `label`, `summary`, `count`, `confidence`, `createdAt`.

   - Note: Evidence is empty when access is restricted for incidents involving minors.

8. **IncidentEvidenceRestriction**

   - Information about restricted evidence access.

   - Properties: `reason` (enum: `minor\_personal\_data`), `contactEmail` (always `info@avisave.com`).

9. **IncidentTimelineEvent**

   - A single event in the incident timeline.

   - Properties: `id`, `sequence`, `observedAt`, `displayTime`, `title`, `summary`, `createdAt`.

10. **IncidentValidation**

    - Community validation metrics for an incident.

    - Properties: `upVotes`, `downVotes` (both integers \>= 0).

11. **Pagination**

    - Pagination metadata for list responses.

    - Properties: `limit`, `offset`, `nextOffset` (nullable).

12. **PublicApiMeta**

    - Response metadata.

    - Properties: `generatedAt` (datetime), `cacheTtlSeconds` (integer).

13. **ApiError**

    - Standard error response structure.

    - Properties: `error` (string), `message` (string).


## Capabilities

- [x] **Search**: Yes, via `GET /incidents` with `search` parameter. Provides public-safe keyword and semantic search across incident titles, summaries, locations, names, and public evidence labels/summaries.

- [x] **Read operations**: Yes, fetching incident summaries with full filtering and pagination support.

- [x] **Filtering**: Yes, by `category`, `severity`, `verification` status, and generic `filter` parameter.

- [x] **Pagination**: Yes, via `offset` and `limit` parameters (1-50 items per page, offset 0-10000).

- [x] **Geographic information**: Yes, via `IncidentLocation` with `latitude`, `longitude`, `locality`, `region`, `countryCode`, and `precisionMeters`.

- [x] **Categories**: Yes, supports 8 incident categories: Critical, Collapsed, Missing, Rescued, Medical, Roads, Shelters, Utilities, Supplies.

- [x] **Severity levels**: Yes, supports Critical, High, Medium, Resolved.

- [x] **Verification status**: Yes, tracks VERIFIED, VERIFYING, NEEDS REVIEW.

- [x] **Confidence levels**: Yes, tracks High, Medium, Low confidence.

- [x] **Timeline tracking**: Yes, via `latestTimelineEvent` and linked incidents.

- [x] **Evidence handling**: Yes, with evidence arrays and restriction information for sensitive data.

- [x] **Community validation**: Yes, via upvote/downvote system.

- [x] **Rate limiting**: Yes, with standard rate limit headers.

- [x] **Localization**: Yes, supports `es` and `en` locales.

- [ ] **Update operations**: No direct PUT/PATCH endpoints exposed publicly.

- [ ] **Create operations**: No POST endpoints exposed in public API.

- [ ] **Delete operations**: No DELETE endpoints exposed in public API.


## Mapping to GeoResponde

### Discovery & Search

- The `GET /incidents` endpoint maps directly to GeoResponde's **Find** module for searching disaster incidents.

- GeoResponde users can search by keywords, and the `search` parameter will handle full-text matching across relevant fields.

- Category and severity filters allow GeoResponde to present faceted search options to users.

- The `locale` parameter enables language-appropriate responses for Spanish-speaking users.

### Incident Data

- Incident summaries can be normalized into GeoResponde's unified incident schema.

- `IncidentLocation` provides all necessary geographic data for map display.

- `category` maps to GeoResponde's incident type classification.

- `severity` and `verification` status provide additional context for prioritization.

### Evidence & Validation

- Evidence arrays can be displayed as supporting information for each incident.

- The upvote/downvote validation system provides social proof and can influence result ranking.

- Evidence restrictions for minors are clearly marked and should be respected in GeoResponde's display.

### Timeline & Relationships

- `latestTimelineEvent` provides the most recent update, useful for displaying "last updated" information.

- `linkedIncidentIds` allows GeoResponde to show related incidents and provide a more comprehensive view.


## Search Strategy

### Workflow

1. A user enters a query in GeoResponde (e.g., "hospital Caracas" or filters by category "Missing").

2. GeoResponde translates this into a live query: `GET /incidents?search=hospital Caracas&category=Medical&locale=es`.

3. GeoResponde fetches the response and normalizes the `PublicIncidentSummary` objects into GeoResponde's unified schema.

4. GeoResponde displays the results natively, badging them with the Avisave provider source.

5. Users can view the normalized result, or click "Open Original Resource" to be directed to Avisave's platform (if URL structure is available).

### Advanced Queries

- **Category-specific search**: `GET /incidents?category=Missing&severity=Critical`

- **Location-based search**: `GET /incidents?search=Caracas` (searches across location fields)

- **Verification filter**: `GET /incidents?verification=VERIFIED` (only show verified incidents)

- **Combined filters**: `GET /incidents?category=Shelters&severity=High&limit=50`

### Limitations

- **No Geospatial Queries**: The API does not support bounding box (`bbox`) or radius search parameters, making precise map-based discovery difficult. Workaround: Use keyword search with location names.

- **No Full GeoJSON Export**: While incidents contain coordinates, there's no dedicated GeoJSON endpoint for bulk geospatial data retrieval.

- **Read-Only**: The public API is read-only; report submission requires a different (likely authenticated) API endpoint not exposed in the public spec.

- **Media Restrictions**: Evidence media is restricted from public responses, particularly for incidents involving minors.


## Provider Evaluation

### Strengths

- **Comprehensive Incident Model**: The API covers a wide range of disaster incident types (8 categories) with detailed metadata.

- **Strong Filtering Capabilities**: Supports filtering by category, severity, verification status, and free-text search.

- **Internationalization**: Built-in locale support for Spanish and English.

- **Pagination**: Well-implemented pagination with sensible defaults (20 items, max 50).

- **Rate Limiting**: Proper rate limiting with standard headers for client awareness.

- **Data Privacy**: Explicit handling of personal data redaction and evidence restrictions for minors.

- **Validation System**: Community validation via upvote/downvote provides trust signals.

- **Timeline Support**: Incident timelines allow users to understand incident progression.

- **API Discovery**: Self-describing API with discovery endpoints and OpenAPI spec access.

### Weaknesses

- **Read-Only Public API**: No write operations (report submission) are available in the public API. This limits direct integration for reporting.

- **No Geospatial Queries**: Lack of bounding box or radius search makes map-based discovery suboptimal.

- **No GeoJSON Endpoint**: Would benefit from a dedicated geospatial export endpoint for mapping applications.

- **Evidence Restrictions**: While necessary for privacy, restricted evidence limits the richness of public incident data.

- **Rate Limit Dependency**: Production use requires Redis configuration; without it, the API returns 503 errors.


## Future Collaboration

Observations to discuss with the Avisave team for future API iterations:

1. **Geospatial Search**: Adding `?lat=X&lng=Y&radius=Z` or `?bbox=...` parameters to `/incidents` would enable precise map-based queries, allowing GeoResponde to automatically fetch incidents in the user's current map view.

2. **GeoJSON Export**: An endpoint like `GET /incidents/geojson` that returns a lightweight GeoJSON feature collection of all incidents (without pagination) would allow platforms like GeoResponde to easily render the entire dataset on map layers.

3. **Public Report Submission**: Exposing a public (or rate-limited public) endpoint for submitting new incident reports would enable GeoResponde users to contribute data directly through the platform.

4. **Webhook Support**: Implementing webhooks for new or updated incidents would enable real-time synchronization with GeoResponde.

5. **Enhanced Filtering**: Adding filters for time ranges (e.g., `?createdAfter=`, `?updatedSince=`) and location boundaries would provide more precise data access.

6. **Media Access**: Providing a mechanism for authorized access to evidence media (perhaps via OAuth or API keys) while maintaining privacy protections.

