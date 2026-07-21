# Estoy Aquí ve

- **Status:** Investigating (Research)
- **Platform:** Volunteer Initiative
- **Website:** https://estoyaquive.up.railway.app
- **Integration Type:** JSON API (REST) - Undocumented public API
- **Categories:** Missing Persons, Found Persons, Pets

## Discovery
Estoy Aquí ve is a missing person database that includes both found and missing persons and pets. It exposes a RESTful JSON API with no authentication required. The API appears to be a volunteer-run initiative with endpoints for searching and reporting.

## API Details
- **Endpoint Discovered:** `https://estoyaquive.up.railway.app/api/`
- **Tables (Endpoints):**
  - `/buscar`
  - `/encontradas`
  - `/matches`
  - `/mascotas/buscar`
  - `/mascotas/matches`
  - `/mascotas/encontradas`
  - `/reportar-busqueda`
  - `/reportar-encontrado`
  - `/mascotas/reportar-busqueda`
  - `/mascotas/reportar-encontrado`

- **Authentication:** None required. All endpoints are publicly accessible.
- **Pagination:** Only for `/encontradas`
- **Capabilities:** Searching via `q` parameter.
- **Limitations:** Very limited or hard to find API documentation. No location properties that would allow mapping. Rate limits and CORS policy are unknown.

## Provider Capabilities
- **Search:** ✔ Feasible. The `/buscar` and `/mascotas/buscar` endpoints support query parameters for searching missing persons and pets.
- **Submission:** ? POST endpoints exist (`/reportar-busqueda`, `/reportar-encontrado`, `/mascotas/reportar-busqueda`, `/mascotas/reportar-encontrado`) but GeoResponde does not implement submission abilities without contacting the owner first.

## Response Schemas & Data Model

### Missing Person Schema
Represents data of a missing person, returned by the `/buscar` endpoint.
```json
{
	"id": "00000000-0000-0000-0000-0000000000a1",
	"nombre_completo": "Ana Prueba",
	"cedula": "V-12345678",
	"edad": 53,
	"descripcion": "desaparecido",
	"ultima_ubicacion": "Estado Ejemplo, Municipio Ficticio",
	"reportado_por": "Juan Ejemplo",
	"contacto_reportante": "+58-412-123-4567",
	"fecha_reporte": "2026-07-01T10:00:00Z",
	"foto_filename": "ana_prueba.jpg"
}
```

### Found Person Schema
Represents data of a found person, returned by the `/encontradas` and `/buscar` endpoints.
```json
{
	"id": "00000000-0000-0000-0000-0000000000b1",
	"nombre_completo": "Pedro Encontrado",
	"cedula": "V-11223344",
	"edad_aproximada": 45,
	"descripcion_fisica": "Altura media, cabello oscuro",
	"ubicacion_actual": "Hospital Central de Ejemplo",
	"estado_salud": "estable",
	"reportado_por": "Dr. Test",
	"contacto_reportante": "+58-424-111-2222",
	"fecha_reporte": "2026-07-03T08:00:00Z",
	"foto_filename": "pedro_encontrado.jpg"
}
```

### General Person Search Data Model
Represents the response from the `/buscar` endpoint.
```json
{
  "buscadas": [{array of missing people}],
  "encontradas": [{array of found people}]
}
```

### Found Person Search Data Model
Represents the response from the `/encontradas` endpoint.
```json
{
  "total": number,
  "items": [{array of found people}]
}
```

### Implementation Notes

- The Provider does have a general /buscar endpoint, but does not support paginaion and returns all matching instances (can be over 3000). To mitigate this, the adapter should only return up to constant `MAX_OUTPUT_LENGTH` each from lost and found persons.
- There are no pet reports from the provider, so it is not possible as of writing to implement those to the federated search.
