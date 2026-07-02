# Sitios (Venezuela Reporta aid sites)

Situation-map read source. Proxies Venezuela Reporta's `GET /api/v1/sitios` as a
cached, pre-shaped GeoJSON Point FeatureCollection so the MapLibre "Aid sites"
layer renders it directly — the frontend never touches VR, its 120 req/min
budget, or its raw envelope.

Gateway route: `GET /api/sitios?tipo=&municipio=`. Response headers:
`X-Sitios-Source: live|cache|empty` and `X-Attribution: Venezuela Reporta`
(attribution is required on all VR data).

## Live schema (confirmed)

```json
{
  "ok": true,
  "atribucion": "Venezuela Reporta",
  "sitios": [
    {
      "id": "...",
      "tipo": "acopio|clinica|hospital|refugio|otro",
      "nombre": "...",
      "lat": 10.48, "lng": -66.90,
      "municipio": "...",
      "estado_operativo": "...",
      "necesidades": ["..."],
      "personas_estimadas": 120,
      "nota": "...",
      "frescura": "...",
      "ultimo_reporte_at": "2026-07-01T12:00:00Z",
      "reportes": 4,
      "origen": "..."
    }
  ]
}
```

## Normalization (`parser.ts`)

Each site with usable coordinates becomes a GeoJSON Point Feature
(`[lng, lat]`). Sites without finite, in-range coordinates are dropped.
`necesidades` is always an array. Only `http(s)` `ficha_url`s survive (blocks
`javascript:` and other schemes).

## Caching (`cache.ts`)

Volatile, bounded, in-memory TTL cache (5 min), never persisted. Shields VR's
budget and degrades gracefully: on an upstream failure it serves the last cached
value (`source: 'cache'`) or an empty collection (`source: 'empty'`). Never
throws, never returns 5xx.
