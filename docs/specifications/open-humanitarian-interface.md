# Open Humanitarian Interface (OHI) — Draft v0.1

**Status:** Draft — for discussion

**Related:** Epic "Evaluate the need for an Open Humanitarian Interface (OHI)", Issue "Research Emergency Data Standards", Issue #30 (configuration-centric design)

**Feeds into:** future Emergency Exchange Protocol (EEP)

---

## 1. Purpose and Scope

OHI is **not a platform**. It is an open interface — a canonical schema plus a small set of endpoint contracts — that lets independent humanitarian organizations interoperate while each keeps running its own systems.

GeoResponde's role is not to become the place all humanitarian data lives. Its role is to define OHI, implement generic consumers/parsers against it, and translate existing dialects (CAP, HXL, and others) into it, so that:

- Any CAP-emitting authority is understood without a per-agency adapter.
- Any HXL-tagged dataset is understood without a per-provider adapter.
- Any organization that *wants* to speak OHI natively can do so directly, with no translation layer needed.

OHI sits **above** source dialects, not in place of them:

```
   CAP feeds  ─┐
               ├──►  [ Generic Consumers/Parsers ]  ──►  OHI canonical schema  ──►  GeoResponde (and others)
   HXL data  ──┘                                                ▲
                                                                │
                                          Native OHI providers ─┘  (no translation needed)
```

### Non-goals (v0.1)

- OHI v0.1 does **not** define a write-back/report-submission path. It is **read-only**: consume and normalize, no automatic catalog writes. Report submission is scoped as a v0.2+ concern, informed by what we learn from CAP/HXL consumption.
- OHI does not attempt to replace CAP, HXL, PFIF, or EDXL. It is a normalization target, not a competing wire format.
- OHI does not assume centralized hosting. Any conforming endpoint, self-hosted or third-party, is a valid OHI source.

---

## 2. Canonical Record Types

Two record types cover the two problems identified in the standards research (CAP = incident detection, HXL = humanitarian dataset semantics):

### 2.1 Incident Record

Represents "something is happening, here, at this severity."

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable, source-qualified (e.g. `cap:gdacs:EQ-2026-000123`) |
| `source` | string | yes | Origin system/authority |
| `category` | enum | yes | e.g. `earthquake`, `flood`, `storm`, `fire`, `other` |
| `severity` | enum | yes | `minor` \| `moderate` \| `severe` \| `extreme` \| `unknown` |
| `certainty` | enum | no | `observed` \| `likely` \| `possible` \| `unknown` (from CAP) |
| `location` | GeoJSON geometry | yes | Point or polygon |
| `effective_at` | timestamp | yes | When the incident/alert became effective |
| `expires_at` | timestamp | no | When the alert expires, if applicable |
| `description` | string | no | Free text, source-provided |
| `raw` | object | no | Original untranslated payload, for traceability |

### 2.2 Provider / Report Record

Represents "here is humanitarian data related to an incident or area."

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable, source-qualified |
| `provider` | string | yes | Organization or dataset name |
| `incident_ref` | string | no | Link to an Incident Record `id`, if known |
| `location` | GeoJSON geometry | yes | Point, polygon, or admin-area reference |
| `reported_at` | timestamp | yes | |
| `metrics` | object | no | Normalized key/value, e.g. `{"affected": 1200, "injured": 34}` — populated via tag mapping (HXL `#affected+injured` → `metrics.affected_injured`) |
| `raw` | object | no | Original untranslated payload |

Both record types carry a `raw` passthrough deliberately — normalization should be additive, not lossy. Consumers of OHI can always fall back to the source payload if the canonical fields don't capture something they need.

---

## 3. Search Endpoints

Read-only, query-based discovery over both record types.

```
GET /ohi/v1/incidents
GET /ohi/v1/incidents/{id}
GET /ohi/v1/reports
GET /ohi/v1/reports/{id}
```

### Common query parameters

| Param | Description |
|---|---|
| `bbox` | Bounding box filter (`minLon,minLat,maxLon,maxLat`) |
| `since` / `until` | Time range filter on `effective_at`/`reported_at` |
| `category` | Filter incidents by category |
| `severity` | Minimum severity filter |
| `incident_ref` | Filter reports tied to a specific incident |
| `source` / `provider` | Filter by origin |
| `page` / `limit` | Pagination |

### Response envelope

```json
{
  "ohi_version": "0.1",
  "count": 2,
  "next_page": null,
  "results": [ { "...": "incident or report record" } ]
}
```

This is intentionally boring and predictable — the value of OHI is in the schema and mapping tables underneath, not in endpoint cleverness.

---

## 4. Report Submission (deferred — placeholder only)

Out of scope for v0.1. When scoped, this section will define:

- `POST /ohi/v1/reports` contract
- Idempotency strategy (client-supplied `id` + upsert semantics, likely)
- Validation rules and required-field enforcement
- How submitted reports interact with `auth` (see below)

Flagging this now so the schema in §2 is designed to be write-compatible later without a breaking change.

---

## 5. Metadata

Every response carries:

- `ohi_version` — schema version this response conforms to (see §7)
- `source` / `provider` — always present, for traceability back to the originating system
- `raw` — optional passthrough of untranslated source payload

Metadata is deliberately minimal in v0.1. The goal is a stable core, not an exhaustive one — additional optional fields can be added without breaking consumers (see versioning policy).

---

## 6. Authentication Strategy

v0.1 assumes **public, read-only** sources — consistent with CAP (public broadcast) and HDX-hosted HXL data (public datasets). No authentication is required to consume.

For sources that need it (private/partner feeds), the recommended pattern is:

- **API key via header** (`Authorization: Bearer <token>`) for simple partner feeds.
- No OAuth flow in v0.1 — added complexity isn't justified until a write path or private-partner path exists.

Auth becomes materially more important once report submission (§4) exists, since that introduces a write path and provenance requirements. This is called out explicitly so the omission in v0.1 is a decision, not an oversight.

---

## 7. Versioning

- OHI schema versions follow `major.minor` (e.g. `0.1`, `0.2`, `1.0`).
- Version is:
  - In the URL path (`/ohi/v1/...`) for major versions only.
  - In the response envelope (`ohi_version`) for the precise minor version, so consumers can detect field additions.
- **Minor version bumps** = additive only (new optional fields). Existing consumers must not break.
- **Major version bumps** = may change required fields or endpoint shapes. Old major versions should remain available for a deprecation window.
- Source-dialect versions (CAP 1.1 vs 1.2, HXL tag-schema revisions) are handled entirely inside the consumer/parser mapping tables and never leak into the OHI version — a CAP 1.2 alert and a CAP 1.1 alert should both normalize into the same `ohi_version: 0.1` incident record.

---

## 8. Error Handling

Two layers of errors need distinct handling:

### 8.1 OHI-level errors (the interface itself)

Standard HTTP status codes with a consistent error body:

```json
{
  "error": {
    "code": "invalid_query_param",
    "message": "bbox must contain 4 comma-separated numbers",
    "param": "bbox"
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Malformed query |
| 404 | Unknown record id |
| 429 | Rate limited |
| 500 | Upstream/internal error |

### 8.2 Source-translation errors (inside consumers/parsers)

These are **not** OHI errors — they're data-quality problems in the underlying CAP feed or HXL dataset. Each generic consumer/parser needs its own tolerant-parsing policy:

- **CAP consumer**: malformed alert → log + skip, don't fail the whole feed batch. Missing optional fields → normalize with `unknown`/`null`, never fabricate. Expired alerts (`expires_at` in the past) → still ingest but flag `expired: true`, don't silently drop (a downstream consumer may want history).
- **HXL parser**: untagged columns → excluded from `metrics`, not guessed at. Partially tagged datasets → normalize what's tagged, leave the rest in `raw`. Tag/schema mismatches (e.g. unexpected `+` attribute) → best-effort mapping, log a warning, never hard-fail the whole dataset over one bad column.

This distinction matters for the mock emitters: they should be able to produce both categories of failure independently, so we can verify OHI-level error handling and consumer-level tolerance separately.

---

## 9. Relationship to Source Standards (summary)

| Standard | Role relative to OHI |
|---|---|
| CAP | Source dialect → normalized into **Incident Records** via generic CAP consumer |
| HXL | Source dialect → normalized into **Provider/Report Records** via generic HXL parser |
| PFIF | Under evaluation — likely a third normalization target for person-finder–style records (not yet in scope) |
| EDXL | Broader family CAP belongs to — worth revisiting once CAP consumer is proven, for other EDXL members (e.g. resource messaging) |
| GeoJSON | Used directly as the geometry encoding within OHI records — not a competing standard, a dependency |
| STAC | Reference point for how a mature, minimal, extensible catalog interface can look — informs OHI's own extensibility approach rather than being consumed directly |

Full comparison detail lives in `docs/specifications/ecosystem-comparison.md`.

---

## 10. Open Questions

1. Should `incident_ref` support many-to-many (one report tied to multiple incidents), or is one-to-one sufficient for v0.1?
2. Does `metrics` need a controlled vocabulary now, or can it stay freeform until enough HXL tag-mappings exist to justify one?
3. At what point does report submission (§4) become necessary, versus staying read-only indefinitely?
4. Should OHI define its own bulk/export endpoint, or is single-record pagination sufficient given expected data volumes?

---

## 11. Next Steps

1. Build **mock emitters** (CAP + HXL) to exercise this spec before any live source is touched — see companion issue.
2. Implement the **generic CAP consumer** against the CAP mock emitter, then GDACS.
3. Implement the **generic HXL parser** against the HXL mock emitter, then HDX.
4. Revisit §4 (report submission) only after both consumers are stable and read-only behavior is validated.
