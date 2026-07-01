# EONET read adapter

Proxies NASA EONET v3 `/events` through the Fastify gateway as a cached,
pre-sorted GeoJSON read source (`GET /api/eonet/events`). The frontend must hit
this gateway route, never EONET directly — caching and the 60 req/min budget
live here.

- `parser.ts` — defensive, pure transform: raw EONET events → a GeoJSON
  `FeatureCollection` sorted ascending by first-appearance date.
- `cache.ts` — volatile, bounded, in-memory TTL cache. Never persisted: a
  process restart loses nothing unique (GeoResponde is a federator, not a store).
- `service.ts` — builds/validates the EONET URL, fetches, caches, and degrades
  gracefully (stale cache → empty FeatureCollection, never a crash).

## Why `earthquakes` is filtered out

EONET v3 *does* expose an `earthquakes` category, but it is a curated, abandoned
relic: **15 events total, all dated 2015–2018, none since.** It is not a live or
comprehensive seismic feed, so the parser drops it (`EARTHQUAKES_CATEGORY`).

Live earthquake data for GeoResponde must come from the **USGS Earthquake
Hazards Program** (`earthquake.usgs.gov/fdsnws/event/1/` — real-time GeoJSON,
magnitude/time/bbox filters, no auth). That sibling layer is deferred to v1+
(SIT-02) and is out of scope for this adapter.

## bbox axis order

EONET's `bbox` param is ordered **W, N, E, S** (`minLon, maxLat, maxLon, minLat`)
— maxLat comes before maxLon, unlike standard GeoJSON. The `{iso2 → bbox}`
registry in `@georesponde/shared` (`COUNTRY_BBOX`, `bboxToEonetParam`) stores and
emits boxes in that exact order. Venezuela: `-73.4,12.2,-59.8,0.6`.
