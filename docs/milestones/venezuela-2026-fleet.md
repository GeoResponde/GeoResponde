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
| Encuéntralos (tecnosoft.dev) | Missing/found persons, shelters | Public REST `/api/personas` | REST | `provider/encuentralos` |
| Úbícame (911.ubica.me) | Victims (missing/alive/hospitalized) | Static JSON shards A–Z | REST | `provider/ubicame` |
| Busca en Listas VZLA | OCR hospital/shelter lists | FastAPI `/search` | REST | `provider/buscaenlistas` |
| Desaparecidos Terremoto VE | Missing persons | _under investigation_ | — | `provider/desaparecidos-terremoto` |
| Hazlo Hoy Terremoto | _under investigation_ | — | — | `provider/hazlohoy` |
| Apoyo (salu.pro) | Aid/resources | _under investigation_ | — | `provider/apoyo-salu` |
| Venezuela Reporta | Citizen reports | _under investigation_ | — | `provider/venezuelareporta` |
| Reencuentra VE | Family reunification | _under investigation_ | — | `provider/reencuentra-ve` |

> Several of these sites aggregate one another (e.g. Encuéntralos and Úbícame
> sync from Venezuela Reporta, Venezuela Te Busca and others). Where an upstream
> original source exists, prefer federating that source directly to avoid
> double-counting; the gateway can later deduplicate by name + location.

## Notes on data ethics

These datasets contain sensitive personal data (names, partial ID numbers,
photos of missing people). GeoResponde federates access and always links back to
the authoritative provider; it does not re-host or claim ownership of this data,
consistent with the project's federation-over-duplication principle.
