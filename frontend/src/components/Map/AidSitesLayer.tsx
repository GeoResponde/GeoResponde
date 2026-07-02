import { useEffect, useState } from 'react';
import { Source, Layer as MapLayer, Popup, useMap } from 'react-map-gl';
import type { MapLayerMouseEvent } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import {
  TIPO_COLORS,
  TIPO_COLOR_FALLBACK,
  type AidSiteRenderFeature,
} from '../../lib/sitios';

export const AID_SITES_LAYER_ID = 'aid-sites-viz';

interface Props {
  features: AidSiteRenderFeature[];
  activeTipos?: Set<string>;
}

interface PopupState {
  longitude: number;
  latitude: number;
  tipo: string;
  nombre: string;
  estadoOperativo?: string;
  necesidades: string[];
  frescura?: string;
  fichaUrl?: string;
}

/** Only http/https anchors are rendered — blocks `javascript:` and other schemes. */
function safeHref(url?: string): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** Build the MapLibre `circle-color` match expression from TIPO_COLORS. */
function buildColorExpression(): unknown[] {
  const match: unknown[] = ['match', ['get', 'tipo']];
  for (const [tipo, color] of Object.entries(TIPO_COLORS)) {
    match.push(tipo, color);
  }
  match.push(TIPO_COLOR_FALLBACK);
  return match;
}

function popupFromFeature(f: AidSiteRenderFeature): PopupState {
  const [longitude, latitude] = f.geometry.coordinates;
  const p = f.properties;
  return {
    longitude,
    latitude,
    tipo: p.tipo,
    nombre: p.nombre,
    estadoOperativo: p.estado_operativo,
    necesidades: p.necesidades ?? [],
    frescura: p.frescura,
    fichaUrl: p.fichaUrl,
  };
}

/**
 * MapLibre circle layer for Venezuela Reporta aid sites, colored per `tipo`,
 * with a click-to-open popup. The popup reads the FULL feature (from the passed
 * `features` array, not the map's serialized properties) so `necesidades` stays
 * a real array. Attribution ("Venezuela Reporta") is shown on the popup.
 */
export function AidSitesLayer({ features, activeTipos }: Props) {
  const { t } = useTranslation();
  const map = useMap().current;
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    if (!map) return;

    const onClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = String((feature.properties ?? {}).id ?? '');
      const full = features.find((f) => f.properties.id === id);
      if (full) {
        setPopup(popupFromFeature(full));
      }
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', AID_SITES_LAYER_ID, onClick);
    map.on('mouseenter', AID_SITES_LAYER_ID, onEnter);
    map.on('mouseleave', AID_SITES_LAYER_ID, onLeave);
    return () => {
      map.off('click', AID_SITES_LAYER_ID, onClick);
      map.off('mouseenter', AID_SITES_LAYER_ID, onEnter);
      map.off('mouseleave', AID_SITES_LAYER_ID, onLeave);
    };
  }, [map, features]);

  const filter: unknown[] | undefined = activeTipos
    ? ['in', ['get', 'tipo'], ['literal', [...activeTipos]]]
    : undefined;

  const data = { type: 'FeatureCollection' as const, features };
  const tipoLabel = popup ? t(`situation.sitios.tipos.${popup.tipo}`) : '';
  const color = popup ? (TIPO_COLORS[popup.tipo] ?? TIPO_COLOR_FALLBACK) : '';
  const href = popup ? safeHref(popup.fichaUrl) : null;

  return (
    <>
      <Source id="aid-sites-src" type="geojson" data={data}>
        <MapLayer
          id={AID_SITES_LAYER_ID}
          type="circle"
          {...(filter ? { filter: filter as never } : {})}
          paint={{
            'circle-color': buildColorExpression() as never,
            'circle-radius': 7,
            'circle-stroke-width': 1.5,
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
          maxWidth="280px"
        >
          <div style={{ color: '#0f172a', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              {popup.nombre || t('situation.sitios.untitled')}
            </div>
            <div
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: color,
                borderRadius: '10px',
                padding: '1px 8px',
                marginBottom: '6px',
              }}
            >
              {tipoLabel}
            </div>
            {popup.estadoOperativo && (
              <div style={{ color: '#475569', fontSize: '12px' }}>
                {t('situation.sitios.estadoOperativo')}: {popup.estadoOperativo}
              </div>
            )}
            {popup.necesidades.length > 0 && (
              <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>
                {t('situation.sitios.necesidades')}: {popup.necesidades.join(', ')}
              </div>
            )}
            {popup.frescura && (
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                {t('situation.sitios.frescura')}: {popup.frescura}
              </div>
            )}
            {href && (
              <div style={{ marginTop: '6px' }}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#2563eb', fontSize: '12px', textDecoration: 'none' }}
                >
                  {t('situation.sitios.viewRecord')} ↗
                </a>
              </div>
            )}
            <div
              style={{
                color: '#94a3b8',
                fontSize: '10px',
                marginTop: '6px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '4px',
              }}
            >
              {t('situation.sitios.attribution')}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
