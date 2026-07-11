## Overview

- **Relevant API URL**: `https://avisave.com/api/public/incidents`

- **OpenAPI URL**: `https://api.avisave.com/api/public/openapi.json`

- **Authentication**: None required.

- **Versioning**: v1

- **Rate limits**: Yes, enforced with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Production requests require Redis configuration.

- **CORS**: Expected to be enabled for public consumption.

- **Data format**: JSON (`application/json`)

- **General observations**: The API is focused on public disaster incident summaries with minor personal data redaction. Evidence media is restricted from public responses. It provides semantic search capabilities across incident data and supports filtering by category, severity, and verification status.


## Relevant Endpoint

`GET /incidents`

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

- Search via `GET /incidents` with `search` parameter. Provides public-safe keyword and semantic search across incident titles, summaries, locations, names, and public evidence labels/summaries.

- Fetch incident summaries with full filtering and pagination support.

- Filtering by `category`, `severity`, `verification` status, and generic `filter` parameter.

- Pagination via `offset` and `limit` parameters (1-50 items per page, offset 0-10000).

- Geographic information via `IncidentLocation` with `latitude`, `longitude`, `locality`, `region`, `countryCode`, and `precisionMeters`.

- Supports 8 incident categories: Critical, Collapsed, Missing, Rescued, Medical, Roads, Shelters, Utilities, Supplies.

- Supports Severity levels, Critical, High, Medium, Resolved.

- Tracks verification statuses, VERIFIED, VERIFYING, NEEDS REVIEW.

- Tracks High, Medium, and Low confidence.

- Timeline tracking via `latestTimelineEvent` and linked incidents.

- Evidence handling with evidence arrays and restriction information for sensitive data.

- Community validation via upvote/downvote system.

- Rate limiting with standard rate limit headers.

## Limitations

- No direct PUT/PATCH endpoints exposed publicly.

- No POST endpoints exposed in public API.

## Notes

- Since there is data that has been redacted in the API, the adapter has to accommodate for this. For instance, there are moments where the location from an incident's data will be redacted, leaving the location's longitude and latitude undefined. For this reason, the location of certain normalized search results will have to be left undefined.
