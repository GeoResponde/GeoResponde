import { useEffect, useState } from 'react';
import { Source, Layer as MapLayer, Popup, useMap } from 'react-map-gl';
import type { MapLayerMouseEvent } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK, type RenderFeature } from '../../lib/eonet';

export const EONET_LAYER_ID = 'eonet-events-viz';

interface Props {
  features: RenderFeature[];
  visibleEpoch?: number | null;
  activeCategories?: Set<string>;
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
export function EonetLayer({ features, visibleEpoch = null, activeCategories }: Props) {
  const { t } = useTranslation();
  const map = useMap().current;
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    if (!map) return;

    const onClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties ?? {};
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
  }, [map]);

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
          onClose={() => setPopup(null)}
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
