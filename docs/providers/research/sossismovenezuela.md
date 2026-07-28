# Provider Investigation: SOS Sismo Venezuela 

## Overview
**Provider Name:** SOS Sismo Venezuela
**Website:** `https://sossismovenezuela.com/`
**Purpose:** Centralizes data from various sources and platforms to facilitate searches for persons, shelters and emergency numbers.

## Endpoints Discovered

1. **Supabase PostgREST API**
   - **Base URL:** `https://pjbxkshoxcglucfzxlfe.supabase.co/rest/v1/`
   - **Tables:** 
    - POST `/rpc/search_personas`
    - GET `/personas_no_localizadas`
    - GET `/centros_acopio_public`
    - GET `/recursos`
    - GET `/necesidades_public`
    - GET `/telefonos_emergencia`
   - **Type:** REST (PostgREST)
   - **Machine-readable:** Yes (JSON).

## Authentication
- **Type:** API Key / Bearer Token.
- **Details:** The frontend uses a public Supabase `anon` key.
  - Header: `apikey: <anon_key>`
  - Header: `Authorization: Bearer <anon_key>`

## Provider Capabilities
- **Search:** ✅ **Experimentally verified.** The `/personas_no_localizadas` table can be queried directly via PostgREST.
- **Submission:** ❌ **Unknown** Submission endpoints may exist but none were publicly exposed.
- **Volunteer Coordination:** ❌ **Unknown**. Volunteer/responder dashboards may exist but would require making an authorized account.
- **Collection Centers / Shelters:** ✅ **Experimentally verified.** Via `/centros_acopio_public`.
- **Resource Requests / Incidents:**  ✅ **Experimentally verified.** The schema from `/centros_acopio_public` contains an array of accepted items.
- **Missing Persons:** ✅ **Available.** The `/personas_no_localizadas` endpoint includes them.

## Data Model

The provider uses a `search_personas` table to store data on people.

**search_personas and personas_no_localizadas Schema:**
```json
  {
    "id": "71be7857-d268-4ac7-9364-51264b3e80e4",
    "nombre": "Ana",
    "apellido": "Prueba",
    "edad": 50,
    "genero": feminino,
    "descripcion": "Example Description.",
    "ultima_ubicacion": "Campo de Golf, Caraballeda",
    "foto_url": "https://example.com/some/path",
    "estado": "buscada",
    "latitude": null,
    "longitude": null,
    "ciudad": null,
    "zona": null,
    "ultima_vez_contactado": null,
    "link_externo": null,
    "nationality_prefix": null,
    "venezuelan_id": null,
    "venezuelan_id_masked": null,
    "venezuelan_id_public": false,
    "public_contact_phone": "000-000-0000",
    "allow_public_contact": true,
    "contact_whatsapp_available": true,
    "reporter_name": null,
    "reporter_email": null,
    "relacion_reportante": null,
    "created_at": "2026-06-05T01:30:41.812295+00:00",
    "updated_at": "2026-06-05T01:30:41.812295+00:00",
    "total_count": 72572
  }
```

**centros_acopio_public**

```json
{
    "id": "3c807794-b62f-4c3c-abda-d3a2f8a7a05b",
    "nombre": "Iglesia La Paz",
    "direccion": "Iglesia La Paz en Montalbán I, Municipio Libertador",
    "address_reference": "Montalbán I",
    "ciudad": "Caracas",
    "state": "Distrito Capital",
    "municipality": "Municipio Libertador",
    "zone": "Montalbán I",
    "country": "Venezuela",
    "telefono": null,
    "horario": null,
    "items_aceptados": [
      "Agua potable",
      "Alimentos no perecederos",
      "Insumos médicos",
      "Ropa y abrigos"
    ],
    "source": "Instagram / Operación Todos con VZLA / @convzlacomando",
    "source_url": null,
    "estado": "verificado",
    "latitude": 10.4708,
    "longitude": -66.9583,
    "created_at": "2026-06-25T08:14:32.695073+00:00",
    "updated_at": "2026-06-25T22:29:32.808129+00:00"
  }
```

**recursos**

```json
{
    "id": "064487a2-ea04-4d60-a6c3-fe61f6d281cd",
    "titulo": "FUNVISIS - Información sísmica",
    "categoria": "Información",
    "descripcion": "Reportes oficiales de actividad sísmica en Venezuela",
    "url": "https://funvisis.gob.ve",
    "telefono": null,
    "estado": "verificado",
    "created_by": null,
    "created_at": "2026-06-25T06:20:55.92206+00:00",
    "updated_at": "2026-06-25T06:20:55.92206+00:00",
    "latitude": null,
    "longitude": null,
    "ciudad": null,
    "zona": null,
    "exact_address": null,
    "address_reference": null
}
```

**telefonos_emergencia**
```json
{
    "id": "05a2d028-75d5-4c5a-9e36-e824537790ed",
    "nombre": "Emergencias 911",
    "numero": "911",
    "categoria": "General",
    "region": null,
    "descripcion": "Atención de emergencias a nivel nacional",
    "orden": 1,
    "created_at": "2026-06-25T06:20:55.92206+00:00",
    "updated_at": "2026-06-25T06:20:55.92206+00:00",
    "latitude": null,
    "longitude": null,
    "city": null,
    "state": null,
    "country": "Venezuela",
    "operator": null,
    "source": null,
    "source_url": null,
    "status": "verificado",
    "notes": null,
    "last_verified_at": null
  }
```

## Integration Strategy

An adapter can be seamlessly implemented using our existing Provider Gateway architecture.

**Search Implementation:**
1. Use `fetchJson` to `GET <**BASE URL**>/personas_no_localizadas` and `GET <**BASE URL**>/centros_acopio_public`.
2. Append appropriate URL queries to filter by search.
3. Pass headers: 
   - `apikey`: `<anon_key>`
   - `Authorization`: `Bearer <anon_key>`
4. Map the result to `NormalizedSearchResult[]`

## Verification
- Opened `personas_no_localizadas` in a browser with both the visible API key as a parameter and `nombre=like.*Maria*` and it correctly returned results with the name Maria.

## Final Recommendation: Option A (Integrate as Search Provider)

**Integrate as Search Provider.**

### Justification:

Sismo Venezuela takes data from various sources, returning collection centers and missing persons. The mappings for such is compatible with GeoResponde's NormalizedSearchResult[].

We should start by implementing a `SOSSismoVeAdapter` that queries the appropriate endpoints for persons and collection centers and integrates them into our Federated Search UI. Submission should be deferred until we have a formal partnership or API sandbox.

## Final Notes

- A select parameter was used in the adapter for `/personas_no_localizadas` to only select the relevant fields, reducing the response and schema size.
- 
