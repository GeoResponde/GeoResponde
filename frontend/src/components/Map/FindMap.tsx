import { useMemo, useState } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { NormalizedSearchResult } from '@georesponde/shared';

const TYPE_COLOR: Record<string, string> = {
  person: '#3b82f6',
  building: '#ef4444',
  report: '#f59e0b',
  pet: '#22c55e',
  resource: '#a855f7',
  dataset: '#64748b',
};

function colorFor(r: NormalizedSearchResult): string {
  return TYPE_COLOR[r.type] || '#94a3b8';
}

function hasCoords(r: NormalizedSearchResult): boolean {
  return Array.isArray(r.location) && r.location.length === 2 && r.location.every((n) => Number.isFinite(n));
}

/**
 * Map view for Find. Plots the results that carry coordinates as pins; results
 * without a location stay in the list (a counter shows how many were dropped).
 */
export function FindMap({ results }: { results: NormalizedSearchResult[] }) {
  const located = useMemo(() => results.filter(hasCoords), [results]);
  const [selected, setSelected] = useState<NormalizedSearchResult | null>(null);
  const initial = located[0]?.location;

  return (
    <div style={{ position: 'relative', height: '62vh', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
      <Map
        mapLib={maplibregl as never}
        initialViewState={{
          longitude: initial ? initial[0] : -66.9036,
          latitude: initial ? initial[1] : 10.4806,
          zoom: initial ? 9 : 5,
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />
        {located.map((r, i) => (
          <Marker
            key={i}
            longitude={r.location![0]}
            latitude={r.location![1]}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(r);
            }}
          >
            <div
              title={r.title}
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: colorFor(r),
                border: '2px solid #fff',
                cursor: 'pointer',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              }}
            />
          </Marker>
        ))}
        {selected && selected.location && (
          <Popup
            longitude={selected.location[0]}
            latitude={selected.location[1]}
            onClose={() => setSelected(null)}
            closeOnClick={false}
            anchor="bottom"
            maxWidth="280px"
          >
            <div style={{ color: '#0f172a' }}>
              <strong>{selected.title}</strong>
              {selected.subtitle && <div style={{ fontSize: '12px', margin: '4px 0' }}>{selected.subtitle}</div>}
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', textTransform: 'capitalize' }}>
                {selected.type} · {selected.provider}
              </div>
              <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#2563eb' }}>
                Abrir ↗
              </a>
            </div>
          </Popup>
        )}
      </Map>
      {results.length > located.length && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            background: 'rgba(15,23,42,0.85)',
            color: '#cbd5e1',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        >
          {located.length} con ubicación · {results.length - located.length} sin coordenadas (ver lista)
        </div>
      )}
    </div>
  );
}
