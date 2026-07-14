# Te Busco

- **Status:** Integrated
- **Platform:** Volunteer Initiative
- **Website:** https://tebusco.app/
- **Integration Type:** JSON API (Custom `portero` endpoint)
- **Categories:** Missing Persons

## Discovery
Te Busco is a lightweight offline-first PWA created for locating missing persons in Venezuela. The application avoids external libraries and images, focusing on low bandwidth usage. It exposes data through a custom PHP backend script `tebusco-portero.php`.

## API Details
- **Endpoint Discovered:** `POST https://tebusco.app/tebusco-portero.php`
- **Request Payload:** `{"op": "desaparecidos"}`
- **Authentication:** None required.
- **Limitations:** The API does not accept search filters or pagination parameters. It returns the entire dataset (~300 records currently, ~100kb payload) in a single response.

## Response Schema
The response is a JSON array of records with the following structure:
```json
[
  {
    "uid": "mrjvu7x6upe0",
    "name": "Carlos Eduardo Torres Gómez de la Vega",
    "cid": "V-4.768.297",
    "state": "search",
    "place": "Avenida 1 calle 1...",
    "msg": "Edad 70 años",
    "by_who": "Antonina Malignaggi",
    "ts": 1783987068570,
    "updated_at": "2026-07-13T23:57:49.744309+00:00",
    "phone": "04142450810",
    "color_pulsera": null,
    "codigo_pulsera": null
  }
]
```

**State Mappings:**
- `search` → `missing`
- `hurt` → `hospitalized` (or injured)
- `located` → `found`
- `safe` → `safe`
- `reunited` → `found`
- `gone` → `unknown` (Info Sensible)

## Capabilities
- **Search**: ✔ Supported. Handled by downloading the full dataset and filtering in-memory using the adapter.
- **Submission**: Currently unsupported through the GeoResponde API. While the provider appears to expose submission endpoints (e.g., `reportar`), GeoResponde intentionally does not implement submission until those endpoints are officially documented or authorized by the provider.

## Upstream Owner & Licensing
- **Owner**: Te Busco Volunteer Initiative.
- **Licensing**: Unknown (publicly accessible web platform).

## Implementation Notes
- Because the dataset is small but unfiltered, the adapter issues the `POST` request, normalizes the entire dataset into `NormalizedSearchResult[]`, and then filters the normalized results in-memory.
- Source attribution is mapped to `https://tebusco.app/`.
