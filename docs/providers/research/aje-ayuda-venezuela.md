# AJE Ayuda Venezuela

- **Status:** Investigated (Research)
- **Platform:** Volunteer Initiative
- **Website:** https://ajevenezuela.org/ayuda-venezuela
- **Integration Type:** JSON API (Supabase PostgREST) - Official but undocumented frontend API
- **Categories:** Volunteer Coordination, Collection Centers, Donations

## Discovery
AJE Ayuda Venezuela is built as a single-page React/Vite application. It does not use traditional server-side rendering or a hidden REST/GraphQL backend of its own. Instead, it interacts directly with a Supabase PostgreSQL database using the PostgREST API.

The anon key and project URL are embedded in the frontend JavaScript bundle. This anon key is treated as a public configuration value, as RLS (Row Level Security) provides the actual protection. The upstream API is an official but undocumented frontend API, consumed directly by the production application.

## API Details
- **Endpoint Discovered:** `https://jtrorjemdsuvfhxionva.supabase.co/rest/v1/`
- **Tables (Endpoints):**
  - `/ayuda_centros_acopio`
  - `/ayuda_donaciones`
  - `/ayuda_voluntariado`
  - `/ayuda_reportes`
  - `/ayuda_admins`
  - `/ayuda_inventario_movimientos`
  - `/ayuda_inventario_items`
  - `/ayuda_iniciativas`
  - `/ayuda_socio_impactos`
  - `/ayuda_iniciativa_apoyos`
- **Authentication:** Public reads are permitted via the Supabase anonymous JWT key (`anon` role). Row Level Security (RLS) is configured to allow `SELECT` queries on all of the `ayuda_*` tables listed above.
- **Views and RPC Functions:** The frontend makes use of several RPC endpoints that may be optimized for specific queries, such as `/rpc/get_iniciativas_kpis`, `/rpc/list_ayuda_iniciativas_admin`, `/rpc/get_ayuda_socio_impactos_kpis`, and `/rpc/list_ayuda_socio_impactos_public`.
- **Pagination:** PostgREST natively supports pagination. Requests can use `limit` and `offset` query parameters, or standard `Range` headers (e.g. `Range: 0-49`).
- **Realtime capabilities:** The application connects to Supabase Realtime via WebSockets (`.channel()`, `postgres_changes`). This could be explored as a future enhancement for streaming updates directly into GeoResponde, without polling.
- **Limitations:** As a raw PostgREST API, querying options are standard (filtering via query strings like `?select=*`), but the schema may change without notice since it is an internal implementation detail of the frontend, not a publicized developer API.

## Provider Capabilities
- **Search:** ✔ Feasible (Inferred and Verified). Read access is openly permitted under RLS for all `ayuda_*` tables.
- **Submission:** ❌ Unavailable (for integration). While the `ayuda_reportes` table or others might accept inserts from the frontend, there is no documented submission API, no sandbox, and no explicit authorization to automate submissions into their production Supabase project.

## Response Schemas & Data Model

### Collection Centers (`ayuda_centros_acopio`)
Maps cleanly to GeoResponde's `ShelterRecord` or `ResourceNeed` schemas.
```json
{
  "id": "c03c9533-...",
  "nombre": "Edif. Rita Palace - Los Caobos",
  "direccion": "Av. La Salle...",
  "ciudad": "Caracas",
  "zona": "Los Caobos",
  "contacto_telefono": "0414-...",
  "notas": "Punto de entrega en planta baja...",
  "estado": "activo",
  "latitud": 10.5008,
  "longitud": -66.9189
}
```

### Donations (`ayuda_donaciones`)
```json
{
  "id": "bcb2a79c-...",
  "organizacion": "Save the Children",
  "descripcion": "Organización internacional...",
  "tipo_ayuda": "Ayuda humanitaria a niñez",
  "link_oficial": "https://www.savethechildren.net",
  "estado": "activo"
}
```

## Integration Strategy
Implementing an adapter is highly feasible. 

1. **Adapter Architecture**: The `AjeAyudaVenezuelaAdapter` would extend `BaseAdapter`.
2. **Search Capability**: It can utilize our standard `getJson` transport to query the Supabase endpoints (e.g., `ayuda_centros_acopio?select=*`).
3. **Authentication**: The Supabase `anon` key would need to be stored in GeoResponde's configuration (or passed securely) and attached to the `apikey` and `Authorization` headers.
4. **Data Normalization**: The parser can easily map the JSON responses to `NormalizedSearchResult` structures without needing a local database or synchronization job, adhering perfectly to our federated constraint.

## Final Recommendation

### **Option A: Integrate as Search Provider**

**Recommendation:** Proceed with Option A. 
We can easily integrate AJE Ayuda Venezuela as a federated search provider for collection centers and donation initiatives. The upstream Supabase API allows direct, stateless queries. We should explicitly omit submission capabilities.


## Implementation Strategy

- **Capabilities**: Search only. No submission allowed as it is an undocumented API.
- **Authentication**: The Supabase Anon key is stored in the Provider Catalog (providers.yaml) and used in headers.
- **Normalization**: Records are mapped to NormalizedSearchResult (	ype: shelter and 	ype: other) and combined.
- **Pagination**: The provider uses Range: 0-99 and Range-Unit: items native PostgREST headers via the shared etchJson transport.