# Venezuela Rescate

- **Status:** Investigated (Research)
- **Platform:** Volunteer Initiative
- **Website:** https://venezuelarescate.com/
- **Integration Type:** JSON API
- **Categories:** Missing Persons

## Discovery
Venezuela Rescate is a citizen network that allows users to search and report missing and hospitalized persons. The application uses Vite/React for the frontend and uses an API from another website (https://rescate.ventatalk.com)

## API Details
- **Endpoint Discovered:** `GET http://rescate.ventatalk.com/api/`
- **Table (Endpoints):**
  - `/buscar`
  - `/hospitales`
  - `/pacientes/buscar`
  - `/pacientes/recientes`
  - `/feed`
- **Authentication:** None required.
- **Limitations:** The API does not accept pagination parameters.

## Response Schema
The response is a JSON array of records with the following structure:

### From /buscar
```json
[
  {
    "id": 81,
    "nombres_apellidos": "Ana Prueba",
    "cedula": ****0000,
    "ultima_ubicacion": "Alguna playa",
    "estado": "desaparecido",
    "tipo_reporte": "desaparecido",
    "foto_url": "https://some_random_link.jpg",
    "created_at": "2026-07-01T23:27:48+00:00"
  },
]
```
### From /pacientes/buscar
```json
[
  {
    "id": 7,
    "hospital_id": 6,
    "nombre_hospital": "Mi hospital",
    "nombres_apellidos": "Ana Prueba",
    "edad": "adulto mayor",
    "sexo": "masculino",
    "cedula": null,
    "parentesco": null,
    "procedencia": "No se",
    "observaciones": null,
    "datos_adicionales": null,
    "foto_captura_url": null,
    "estado_paciente": "estable",
    "reportado_por": null,
    "necesita_ayuda": false,
    "tipo_ayuda": null,
    "created_at": "2026-07-01T08:42:01-04:00",
    "telefono": null,
    "nombre_variantes": null,
    "batch_date": null,
    "fuente": "manual",
    "es_menor": false
  },
]
```

### From /hospitales

```json
[
  {
    "id": 6,
    "nombre": "Mi hospital",
    "direccion": "Maracay, Aragua",
    "zona": "Aragua",
    "telefono": "0555-5555555",
    "tipo": "privado",
    "activo": true
  }
]
```

## Capabilities
- **Search**: ✔ Supported with a `nombre` or `cedula` parameter. (No pagination support)
- **Submission**: Unlikely. Appears to be done via chatbot and not a publicly available API.

## Upstream Owner & Legal Info
- **Owner**: Unknown.
- **Licensing**: Unknown (publicly accessible web platform).
- **Legal Info**: http://venezuelarescate.com/aviso-legal

## Implementation Notes
- The provider does not change the URL when a person is selected. For now the URL for a each NormalizedSearchResult is a simply a link to the provider's corresponding search page.
- The provider has multiple relevant endpoints. The adapter may need to be able to connect to more than one endpoint
- Endpoints return id as a number. They need to be converted to strings to make the type match the NormalizedSearchResult type
- Endpoints return age as a string which can be either a number or a brief description without revealing the exact age e.g. "adulto mayor".
