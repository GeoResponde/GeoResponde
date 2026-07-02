# Milestone: Venezuela 2026 Earthquake Provider Fleet

Following the June 2026 Venezuela earthquake, many independent "find people"
and humanitarian sites appeared, most built quickly and without a shared data
standard. This milestone federates the trusted ones into the **Find** module so
responders and families can search across all of them from a single view,
instead of visiting each site separately.

It builds directly on the [adapter registry](../../backend/src/adapters/registry.ts):
every provider below plugs in by registering an adapter and adding a catalog
entry, with no changes to the Provider Gateway.

## Shared foundation

- `backend/src/transports/rest/client.ts` — generic JSON GET (timeout, BOM-safe).
  Covers plain REST APIs, Supabase REST, and static JSON feeds.
- `backend/src/transports/scrape/client.ts` — Cheerio-based HTML transport, a
  last resort for providers that expose no machine-readable data source
  (see [CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Providers

Each provider ships on its own branch (`provider/<slug>`) with a pure parser,
an adapter, a captured fixture, and unit tests.

| Provider | Data | Source type | Transport | Branch |
|----------|------|-------------|-----------|--------|
| Encuéntralos (tecnosoft.dev) | Missing/found persons | Public REST `/api/personas` | REST | `provider/encuentralos` |
| Úbícame (911.ubica.me) | Victims (missing/alive/hospitalized) | Static JSON shards A–Z | REST | `provider/ubicame` |
| Busca en Listas VZLA | OCR hospital/shelter lists | FastAPI `/search` (lat/lng) | REST | `provider/buscaenlistas` |
| Apoyo (salu.pro) | Missing persons | Next.js `/api/missing-persons` (cursor) | REST | `provider/apoyo-salu` |
| Venezuela Reporta | Consolidated persons | Official open API `/api/v1/personas` | REST | `provider/venezuelareporta` |
| Desaparecidos Terremoto VE | Aid-platform directory | Open `/api/plataformas` (persons behind reCAPTCHA) | REST | `provider/desaparecidos-terremoto` |
| Hazlo Hoy Terremoto | Map markers (persons/buildings/aid) | SSR RSC payload (`markers[]`) | Custom (RSC extract) | `provider/hazlohoy` |
| Reencuentra VE | Family reunification | HTML (Supabase closed) | Scrape (Cheerio) | `provider/reencuentra-ve` |

Also on this milestone: `provider/hdx` federates OCHA's global Humanitarian Data
Exchange (keyless CKAN API) as a reusable, non-Venezuela-specific provider.

**Validated end-to-end:** with all providers registered, the Provider Gateway
loads 10 adapters and a single federated `search("maria")` returns ~229 live
results across 9 providers in ~5s, in parallel and fault-tolerant (a failing
provider yields `[]` without breaking the others).

> Several of these sites aggregate one another (e.g. Encuéntralos and Úbícame
> sync from Venezuela Reporta, Venezuela Te Busca and others). Where an upstream
> original source exists, prefer federating that source directly to avoid
> double-counting; the gateway can later deduplicate by name + location.

## Structured person schema + cédula search

Because every person-oriented provider exposes a slightly different set of
fields, adapters populate a shared, provider-agnostic `PersonRecord`
(`packages/shared`) alongside the free-text `title`/`subtitle`:

`fullName`, `firstName`, `lastName`, `cedula`, `age`, `gender` (canonical),
`status` (canonical: `missing` / `found` / `hospitalized` / `safe` /
`deceased` / `unknown`) + `rawStatus`, `lastSeenLocation`, `lastSeenAt`,
`hospital`, `description`, `photoUrl`, `contact`, `isMinor`, `verified`,
`sourceName`.

Each provider maps its own vocabulary onto the canonical enums via helpers in
`backend/src/adapters/person.ts` (`normalizeGender`, `makeStatusMapper`). The
Find UI renders these as colored status badges and chips (cédula, age, gender,
hospital) instead of a plain line of text.

**Search by cédula:** the gateway detects when a query is a national ID
(`isCedula`) and returns only exact cédula matches (`normalizeCedula`) across
every provider that surfaces the number, so responders can look a person up by
document instead of by name.

## Notes on data ethics

These datasets contain sensitive personal data (names, partial ID numbers,
photos of missing people). GeoResponde federates access and always links back to
the authoritative provider; it does not re-host or claim ownership of this data,
consistent with the project's federation-over-duplication principle.
