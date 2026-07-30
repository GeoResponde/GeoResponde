import { useMemo, useState } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { UnifiedSearchResource } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

const TYPE_COLOR: Record<string, string> = {
  person: '#3b82f6',
  building: '#ef4444',
  report: '#f59e0b',
  pet: '#22c55e',
  resource: '#a855f7',
  dataset: '#64748b',
};

function colorFor(r: UnifiedSearchResource): string {
  return TYPE_COLOR[r.entityType] || '#94a3b8';
}

function getCoords(r: UnifiedSearchResource): [number, number] | null {
  if (r.candidate) {
    const loc = r.candidate.observations[0]?.normalizedFields?.location;
    if (loc && Array.isArray(loc) && loc.length === 2 && loc.every((n) => Number.isFinite(n))) {
      return [loc[0], loc[1]] as [number, number];
    }
  } else if (r.result) {
    const loc = r.result.location;
    if (loc && Array.isArray(loc) && loc.length === 2 && loc.every((n) => Number.isFinite(n))) {
      return [loc[0], loc[1]] as [number, number];
    }
  }
  return null;
}

/**
 * Map view for Find. Plots the candidate entities that carry coordinates as pins; entities
 * without a location stay in the list (a counter shows how many were dropped).
 */
export function FindMap({ results }: { results: UnifiedSearchResource[] }) {
  const located = useMemo(() => results.filter(r => getCoords(r) !== null), [results]);
  const [selected, setSelected] = useState<UnifiedSearchResource | null>(null);
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
                title={r.candidate?.observations[0]?.normalizedFields.title || r.result?.title || 'Ubicación'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px' }}>
                  {selected.candidate?.observations[0]?.normalizedFields?.title || selected.result?.title || 'Unknown'}
                </h4>
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', textTransform: 'capitalize' }}>
                {selected.entityType}
              </div>
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
