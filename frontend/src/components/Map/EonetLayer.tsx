import { useEffect, useState } from 'react';
import { Source, Layer as MapLayer, Popup, useMap } from 'react-map-gl';
import type { MapLayerMouseEvent } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { COUNTRY_BBOX } from '@georesponde/shared';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK, type RenderFeature } from '../../lib/eonet';

export const EONET_LAYER_ID = 'eonet-events-viz';

interface Props {
  features: RenderFeature[];
  visibleEpoch?: number | null;
  activeCategories?: Set<string>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** When set, the camera fits this country's registry bbox on change. */
  country?: string;
}

interface PopupState {
  longitude: number;
  latitude: number;
  title: string;
  category: string;
  sourceUrl: string;
  source: string;
  firstDate: string;
}

/** Only http/https anchors are rendered — blocks `javascript:` and other schemes (T-13-01). */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Build the MapLibre `circle-color` match expression from CATEGORY_COLORS. */
function buildColorExpression(): unknown[] {
  const match: unknown[] = ['match', ['get', 'category']];
  for (const [category, color] of Object.entries(CATEGORY_COLORS)) {
    match.push(category, color);
  }
  match.push(CATEGORY_COLOR_FALLBACK);
  return match;
}

/**
 * MapLibre circle layer for EONET events, colored per category, with a
 * click-to-open popup. Defensive filters: the `<=` epoch clause is applied only
 * when `visibleEpoch` is finite (13-02) and the category `in` clause only when
 * `activeCategories` is provided (13-03).
 */
function popupFromFeature(f: RenderFeature): PopupState {
  const [longitude, latitude] = f.geometry.coordinates;
  const p = f.properties;
  return {
    longitude,
    latitude,
    title: p.title,
    category: p.category,
    sourceUrl: p.sourceUrl,
    source: p.source,
    firstDate: p.firstDate,
  };
}

export function EonetLayer({
  features,
  visibleEpoch = null,
  activeCategories,
  selectedId,
  onSelect,
  country,
}: Props) {
  const { t } = useTranslation();
  const map = useMap().current;
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    if (!map) return;

    const onClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties ?? {};
      const id = String(p.id ?? '');
      if (onSelect) {
        onSelect(id);
        return; // selectedId effect drives the popup + camera
      }
      const [longitude, latitude] = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;
      setPopup({
        longitude,
        latitude,
        title: String(p.title ?? ''),
        category: String(p.category ?? ''),
        sourceUrl: String(p.sourceUrl ?? ''),
        source: String(p.source ?? ''),
        firstDate: String(p.firstDate ?? ''),
      });
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', EONET_LAYER_ID, onClick);
    map.on('mouseenter', EONET_LAYER_ID, onEnter);
    map.on('mouseleave', EONET_LAYER_ID, onLeave);
    return () => {
      map.off('click', EONET_LAYER_ID, onClick);
      map.off('mouseenter', EONET_LAYER_ID, onEnter);
      map.off('mouseleave', EONET_LAYER_ID, onLeave);
    };
  }, [map, onSelect]);

  // When a selection flows in (from the list or a map click), open its popup and
  // ease the camera toward it — mirrors the FindMap select→focus pattern.
  useEffect(() => {
    if (selectedId === undefined) return; // 13-01 mode: click handler owns the popup
    if (!selectedId) {
      setPopup(null);
      return;
    }
    const f = features.find((feat) => feat.properties.id === selectedId);
    if (!f) return;
    setPopup(popupFromFeature(f));
    map?.easeTo({ center: f.geometry.coordinates, duration: 600 });
  }, [selectedId, features, map]);

  // Follow the selected country: fit its registry bbox ([W, N, E, S]).
  useEffect(() => {
    if (!map || !country) return;
    const box = COUNTRY_BBOX[country];
    if (!box) return;
    const [w, n, e, s] = box;
    map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 800 });
  }, [map, country]);

  const filter: unknown[] | undefined = (() => {
    const clauses: unknown[] = ['all'];
    if (typeof visibleEpoch === 'number' && Number.isFinite(visibleEpoch)) {
      clauses.push(['<=', ['get', 'firstDateEpoch'], visibleEpoch]);
    }
    if (activeCategories) {
      clauses.push(['in', ['get', 'category'], ['literal', [...activeCategories]]]);
    }
    return clauses.length > 1 ? clauses : undefined;
  })();

  const data = { type: 'FeatureCollection' as const, features };
  const categoryLabel = popup ? t(`situation.eonet.categories.${popup.category}`) : '';
  const href = popup ? safeHref(popup.sourceUrl) : null;

  return (
    <>
      <Source id="eonet-events-src" type="geojson" data={data}>
        <MapLayer
          id={EONET_LAYER_ID}
          type="circle"
          {...(filter ? { filter: filter as never } : {})}
          paint={{
            'circle-color': buildColorExpression() as never,
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.9,
          }}
        />
      </Source>
      {popup && (
        <Popup
          longitude={popup.longitude}
          latitude={popup.latitude}
          onClose={() => {
            setPopup(null);
            if (onSelect) onSelect(null);
          }}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
          maxWidth="260px"
        >
          <div style={{ color: '#0f172a', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{popup.title}</div>
            <div
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: CATEGORY_COLORS[popup.category] ?? CATEGORY_COLOR_FALLBACK,
                borderRadius: '10px',
                padding: '1px 8px',
                marginBottom: '6px',
              }}
            >
              {categoryLabel}
            </div>
            {popup.firstDate && (
              <div style={{ color: '#475569', fontSize: '11px' }}>
                {t('situation.eonet.firstSeen')}: {new Date(popup.firstDate).toLocaleDateString()}
              </div>
            )}
            {href && (
              <div style={{ marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563eb', fontSize: '12px', textDecoration: 'none' }}
                >
                  {t('situation.eonet.source')}
                  {popup.source ? ` (${popup.source})` : ''} ↗
                </a>
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
