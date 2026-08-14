# Emergency & Humanitarian Data Standards — Ecosystem Comparison

**Status:** Draft — supports Issue "Research Emergency Data Standards" and the OHI Epic

**Companion to:** `docs/specifications/open-humanitarian-interface.md`

This table consolidates the standards named in the research issue, plus HXL (added per napogeof's analysis, since it fills a gap not covered by the original list).

---

## PFIF — People Finder Interchange Format

- **Purpose:** XML format for exchanging "missing/found person" records across person-finder tools, originated after the 2010 Haiti earthquake (Google Person Finder and successors).
- **Advantages:** Purpose-built for exactly one high-value humanitarian task (reuniting families); simple record shape; proven in real disasters.
- **Limitations:** Narrow scope — person-finding only, nothing else; public documentation and active tooling are thin/uncertain today, adoption outside the original Google-affiliated ecosystem is limited.
- **Relevance to GeoResponde:** Candidate third normalization target (alongside Incident/Report records) if/when person-finder-style data becomes part of scope. Not yet prioritized — flagged as an open question in the OHI spec rather than committed to v0.1.

## CAP — Common Alerting Protocol

- **Purpose:** OASIS standard for structured emergency alerts — severity, certainty, urgency, area, effective/expiry — in a common XML/JSON envelope, so any authority can publish one alert format any consumer parses identically.
- **Advantages:** Already the wire format behind sources GeoResponde is near (GDACS, NOAA, many national services); one generic parser covers all CAP emitters; doubles as a real incident-detection trigger rather than heuristic news classification.
- **Limitations:** Alert-level only — tells you an event happened, not who's responding; adoption is real but uneven, plenty of local/regional authorities don't publish CAP.
- **Relevance to GeoResponde:** Normalizes into OHI's **Incident Record**. Directly useful for Situation and any future active-sensing/incident-detection work.

## EDXL — Emergency Data Exchange Language (family)

- **Purpose:** OASIS family of standards for emergency data exchange, of which CAP is one member; other members cover resource messaging, hospital availability, situation reporting, and distribution element routing.
- **Advantages:** Broader coverage than CAP alone — potential path to standardizing resource/capacity data, not just alerts; shares OASIS governance and tooling patterns with CAP, so lessons from a CAP consumer transfer.
- **Limitations:** Less universally adopted than CAP specifically; heavier, more complex schemas for some family members; would need its own dedicated evaluation per sub-standard rather than a single blanket assessment.
- **Relevance to GeoResponde:** Worth revisiting once the CAP consumer is proven — likely the next EDXL member to evaluate is a resource-messaging or situation-reporting component, once Incident Records alone prove insufficient.

## OASIS

- **Purpose:** Not a data standard itself — the standards body that governs CAP, EDXL, and related specifications.
- **Advantages:** Governance context matters for understanding stability, versioning cadence, and who to watch for future revisions.
- **Limitations:** N/A — not directly implementable.
- **Relevance to GeoResponde:** Informational. Useful for tracking upstream changes to CAP/EDXL versioning (see OHI spec §7) rather than something GeoResponde integrates against directly.

## OHI — Open Humanitarian Interface

- **Purpose:** The interface GeoResponde is drafting itself — a canonical schema and endpoint contract that lets independent humanitarian systems interoperate without adopting a shared platform.
- **Advantages:** Not tied to any single source dialect; designed config-centrically (per Issue #30) so new sources are mapping-table additions, not new adapters; deliberately minimal in v0.1 (read-only, no write path) to reduce early scope risk.
- **Limitations:** Unproven — no existing adopters yet; success depends entirely on whether generic CAP/HXL consumers actually hold up against real, messy source data.
- **Relevance to GeoResponde:** This *is* the GeoResponde-side deliverable. Everything else in this table is either a source dialect OHI normalizes (CAP, HXL, PFIF) or a reference point informing its design (STAC).

## GeoJSON

- **Purpose:** IETF standard (RFC 7946) for encoding geographic data structures — points, polygons, feature collections — in JSON.
- **Advantages:** Already universal in web-mapping tooling; zero translation cost since GeoResponde already works in this format; simple enough to embed directly in OHI records rather than wrap.
- **Limitations:** Geometry-only — carries no semantic/domain meaning on its own, which is exactly why CAP/HXL/OHI exist on top of it.
- **Relevance to GeoResponde:** Used directly as the `location` field encoding in OHI's Incident and Report records (see OHI spec §2). A dependency, not a competing standard.

## STAC — SpatioTemporal Asset Catalog

- **Purpose:** Specification for cataloging spatiotemporal assets (originally satellite imagery), with a minimal core plus extensions for domain-specific metadata.
- **Advantages:** Proven pattern for "minimal core + extensible metadata" that scales across very different asset types without forking the base spec; strong precedent for API design (search endpoints, pagination, versioning) that OHI can borrow from.
- **Limitations:** Domain origin is remote-sensing assets, not humanitarian incident/report data — not directly reusable as-is, only as a design reference.
- **Relevance to GeoResponde:** Not consumed directly. Informs OHI's own extensibility approach — the "core schema + optional fields, additive minor versions" pattern in the OHI spec (§7) deliberately mirrors STAC's core-plus-extension philosophy.

## HXL — Humanitarian Exchange Language

- **Purpose:** OCHA-maintained convention for tagging columns in humanitarian datasets (`#affected+injured`, `#loc+name`, `#date+reported`) so they're machine-readable without per-source field mapping by a human. De facto semantic layer across most of HDX.
- **Advantages:** Solves semantic self-description, not just transport — a HXL-tagged file is close to config-only onboarding (one generic parser + a small tag-mapping table); wide existing footprint via HDX; low integration cost since it's a convention on formats already parsed (CSV/JSON), not a new protocol.
- **Limitations:** Only as good as provider adoption — most small/local NGOs won't tag their own data, so value concentrates on HDX-hosted/adjacent sources; no live/streaming variant, it's a periodic-refresh dataset convention, not real-time.
- **Relevance to GeoResponde:** Normalizes into OHI's **Provider/Report Record**. Closest existing analog to config-centric device onboarding (Issue #30) on the humanitarian-data side.

---

## Summary Positioning

| Standard | Type | OHI Role |
|---|---|---|
| CAP | Alert protocol | Source dialect → Incident Record |
| HXL | Dataset tagging convention | Source dialect → Provider/Report Record |
| PFIF | Person-finder format | Candidate future record type (not yet scoped) |
| EDXL | Standards family (incl. CAP) | Future source dialect candidates beyond CAP |
| OASIS | Governance body | Informational — governs CAP/EDXL |
| GeoJSON | Geometry encoding | Dependency — used directly in OHI schema |
| STAC | Catalog spec pattern | Design reference — not consumed directly |
| OHI | This project's interface | The normalization target itself |

The practical takeaway: **CAP and HXL are the two standards with an immediate, concrete implementation path** (generic consumer + generic parser, both read-only, both testable via mock emitters). PFIF and the wider EDXL family are documented as evaluated-but-deferred. OASIS, GeoJSON, and STAC are context/dependencies rather than integration targets in their own right.
