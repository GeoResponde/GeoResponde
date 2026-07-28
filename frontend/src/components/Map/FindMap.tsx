import { useMemo, useState } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CandidateEntity } from '@georesponde/shared';

const TYPE_COLOR: Record<string, string> = {
  person: '#3b82f6',
  building: '#ef4444',
  report: '#f59e0b',
  pet: '#22c55e',
  resource: '#a855f7',
  dataset: '#64748b',
};

function colorFor(c: CandidateEntity): string {
  return TYPE_COLOR[c.entityType] || '#94a3b8';
}

function getCoords(c: CandidateEntity): [number, number] | null {
  for (const obs of c.observations) {
    const loc = obs.normalizedFields.location;
    if (Array.isArray(loc) && loc.length === 2 && loc.every((n) => Number.isFinite(n))) {
      return loc as [number, number];
    }
  }
  return null;
}

/**
 * Map view for Find. Plots the candidate entities that carry coordinates as pins; entities
 * without a location stay in the list (a counter shows how many were dropped).
 */
export function FindMap({ results }: { results: CandidateEntity[] }) {
  const located = useMemo(() => results.filter(r => getCoords(r) !== null), [results]);
  const [selected, setSelected] = useState<CandidateEntity | null>(null);
  const initial = located.length > 0 ? getCoords(located[0]) : null;

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
        {located.map((r, i) => {
          const loc = getCoords(r)!;
          return (
            <Marker
              key={r.id || i}
              longitude={loc[0]}
              latitude={loc[1]}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(r);
              }}
            >
              <div
                title={r.observations[0]?.normalizedFields.title || 'Ubicación'}
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
          );
        })}
        {selected && getCoords(selected) && (
          <Popup
            longitude={getCoords(selected)![0]}
            latitude={getCoords(selected)![1]}
            onClose={() => setSelected(null)}
            closeOnClick={false}
            anchor="bottom"
            maxWidth="280px"
          >
            <div style={{ color: '#0f172a' }}>
              <strong>{selected.observations[0]?.normalizedFields.title}</strong>
              {selected.observations[0]?.normalizedFields.subtitle && <div style={{ fontSize: '12px', margin: '4px 0' }}>{selected.observations[0].normalizedFields.subtitle}</div>}
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', textTransform: 'capitalize' }}>
                {selected.entityType} · {selected.observations.length} reportes
              </div>
              <a href={selected.observations[0]?.normalizedFields.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#2563eb' }}>
                Abrir principal ↗
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
