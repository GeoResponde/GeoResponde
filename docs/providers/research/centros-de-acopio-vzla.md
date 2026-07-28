# Centros de Acopio Vzla

## Overview
- **Name**: Centros de Acopio Vzla
- **URL**: [https://www.centrosdeacopiovzla.com](https://www.centrosdeacopiovzla.com)
- **Data Endpoint**: [https://www.centrosdeacopiovzla.com/data.json](https://www.centrosdeacopiovzla.com/data.json)
- **Integration Status**: Complete
- **Issue**: #119

## Capabilities & Limitations
- **Capabilities**:
  - Provides a comprehensive, live list of collection centers ("centros de acopio") across Venezuela.
  - Data is structured hierarchically by State (`estado`) -> City (`ciudad`) -> Center (`centro`).
  - Includes rich metadata: coordinates (`lat/lng`), Google Maps links, contact numbers, source (`fuente`), and accepted items (`recibe`).
- **Limitations**:
  - Does NOT support automated inbound submissions (reports).
  - Data is fetched entirely in one large JSON payload, making it suitable for caching but not for paginated downstream usage.

## Schema
The payload structure is straightforward and highly nested:
```json
{
  "estados": [
    {
      "nombre": "String",
      "ciudades": [
        {
          "nombre": "String",
          "centros": [
            {
              "nombre": "String",
              "direccion": "String",
              "coords": [lat, lng],
              "maps": "String (URL)",
              "contacto": "String",
              "recibe": ["String"],
              "fuente": "String"
            }
          ]
        }
      ]
    }
  ]
}
```

## Implementation Decisions
- **Adapter**: Uses `this.transport.getJson()` to retrieve the raw JSON data.
- **Parsing**: Flattens the hierarchy and maps it to `NormalizedSearchResult` items. 
  - `recibe` elements are converted directly into tags for the Resolution Engine.
  - Generates a synthetic ID by hashing the center's `coords` or `nombre` + `direccion` to ensure stability across syncs.
- **Caching**: The adapter wraps the raw response parsing with `VolatileTtlCache<NormalizedSearchResult[]>` to protect the upstream server from being bombarded while the federation node is heavily queried.
- **Submission**: Intentionally marked as not implemented since the source is read-only.
