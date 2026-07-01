import React, { useMemo, useState, useCallback } from 'react';
import Map, { Source, Layer as MapLayer, Popup } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCatalog } from '../../hooks/useCatalog';
import { CopernicusLegend } from './CopernicusLegend';
import { EonetLayer, EONET_LAYER_ID } from './EonetLayer';
import type { RenderFeature } from '../../lib/eonet';
import { useArcGISFeatureLayer } from '../../hooks/useArcGISFeatureLayer';
import { useRef } from 'react';
interface Props {
  activeLayerIds: Set<string>;
  unavailableLayerIds?: Set<string>;
  setUnavailableLayerIds?: (ids: Set<string>) => void;
  eonetFeatures?: RenderFeature[];
  showEonet?: boolean;
  eonetVisibleEpoch?: number | null;
  eonetActiveCategories?: Set<string>;
}

export function MapViewer({
  activeLayerIds,
  unavailableLayerIds = new Set(),
  eonetFeatures = [],
  showEonet = false,
  eonetVisibleEpoch = null,
  eonetActiveCategories,
}: Props) {
  const { layers } = useCatalog();
  const mapRef = useRef<MapRef>(null);
  
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    feature: any;
  } | null>(null);


  const [viewState, setViewState] = useState({
    longitude: -66.9036,
    latitude: 10.4806,
    zoom: 5
  });

  const activeLayersWithData = useMemo(() => {
    return layers.filter(l => 
      activeLayerIds.has(l.id) && 
      (l.id === 'layer-earthquakes' || l.id === 'layer-funvisis' || l.id === 'layer-hospitals' || l.id === 'layer-faults' || l.id === 'layer-geologic-units' || l.id === 'layer-sat-before' || l.id === 'layer-sat-after' || l.id === 'layer-copernicus-damage' || l.id === 'layer-copernicus-ground-movement' || l.id === 'layer-nasa-sentinel-damage' || l.id === 'layer-nasa-interferogram' || l.id === 'layer-citizen-reports')
    );
  }, [layers, activeLayerIds]);

  const { featureCollection: nasaFeatures, loading: nasaLoading } = useArcGISFeatureLayer({
    url: 'https://services7.arcgis.com/WSiUmUhlFx4CtMBB/arcgis/rest/services/202610_s1_likelydmgareas/FeatureServer/0',
    bbox: mapBounds,
    where: 'damage>0',
    active: activeLayerIds.has('layer-nasa-sentinel-damage')
  });

  const onHover = useCallback((event: any) => {
    const { features, lngLat } = event;
    const hoveredFeature = features && features[0];

    // EONET circles own their own popup (EonetLayer via useMap); don't let the
    // generic catalog popup capture them.
    if (hoveredFeature && hoveredFeature.layer?.id === EONET_LAYER_ID) {
      setHoverInfo(null);
      return;
    }

    if (hoveredFeature) {
      setHoverInfo({
        longitude: lngLat.lng,
        latitude: lngLat.lat,
        feature: hoveredFeature
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const [imagesLoaded, setImagesLoaded] = useState(false);

  const onMapLoad = useCallback((e: any) => {
    const map = e.target;
    
    const icons = {
      'fault-reverse': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cG9seWdvbiBwb2ludHM9IjEsMTEgNiwxIDExLDExIiBmaWxsPSIjZjFjNDBmIiAvPgo8L3N2Zz4K',
      'fault-normal': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB4PSI1IiB5PSIxIiB3aWR0aD0iMiIgaGVpZ2h0PSIxMCIgZmlsbD0iI2YxYzQwZiIgLz4KPC9zdmc+Cg==',
      'fault-strike-slip': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8IS0tIFRvcCBhcnJvdyBwb2ludGluZyByaWdodCAtLT4KICA8bGluZSB4MT0iMiIgeTE9IjQiIHgyPSIyMiIgeTI9IjQiIHN0cm9rZT0iI2YxYzQwZiIgc3Ryb2tlLXdpZHRoPSIyIiAvPgogIDxwb2x5bGluZSBwb2ludHM9IjE4LDEgMjIsNCAxOCw0IiBmaWxsPSIjZjFjNDBmIiAvPgogIDwhLS0gQm90dG9tIGFycm93IHBvaW50aW5nIGxlZnQgLS0+CiAgPGxpbmUgeDE9IjIiIHkxPSI4IiB4Mj0iMjIiIHkyPSI4IiBzdHJva2U9IiNmMWM0MGYiIHN0cm9rZS13aWR0aD0iMiIgLz4KICA8cG9seWxpbmUgcG9pbnRzPSI2LDExIDIsOCA2LDgiIGZpbGw9IiNmMWM0MGYiIC8+Cjwvc3ZnPgo=',
      'fault-reverse-red': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cG9seWdvbiBwb2ludHM9IjEsMTEgNiwxIDExLDExIiBmaWxsPSIjZTc0YzNjIiAvPjwvc3ZnPg==',
      'fault-normal-red': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSI1IiB5PSIxIiB3aWR0aD0iMiIgaGVpZ2h0PSIxMCIgZmlsbD0iI2U3NGMzYyIgLz48L3N2Zz4=',
      'fault-strike-slip-red': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZSB4MT0iMiIgeTE9IjQiIHgyPSIyMiIgeTI9IjQiIHN0cm9rZT0iI2U3NGMzYyIgc3Ryb2tlLXdpZHRoPSIyIiAvPjxwb2x5bGluZSBwb2ludHM9IjE4LDEgMjIsNCAxOCw0IiBmaWxsPSIjZTc0YzNjIiAvPjxsaW5lIHgxPSIyIiB5MT0iOCIgeDI9IjIyIiB5Mj0iOCIgc3Ryb2tlPSIjZTc0YzNjIiBzdHJva2Utd2lkdGg9IjIiIC8+PHBvbHlsaW5lIHBvaW50cz0iNiwxMSAyLDggNiw4IiBmaWxsPSIjZTc0YzNjIiAvPjwvc3ZnPg=='
    };

    let loadedCount = 0;
    const keys = Object.keys(icons);
    
    keys.forEach(icon => {
      const img = new Image();
      img.onload = () => {
        if (!map.hasImage(icon)) {
          map.addImage(icon, img);
        }
        loadedCount++;
        if (loadedCount === keys.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load ${icon}`);
        loadedCount++;
        if (loadedCount === keys.length) setImagesLoaded(true);
      };
      img.src = icons[icon as keyof typeof icons];
    });

    if (map) {
      const bounds = map.getBounds();
      setMapBounds([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    }
  }, []);

  const onMapMoveEnd = useCallback((e: any) => {
    const map = e.target;
    if (map) {
      const bounds = map.getBounds();
      setMapBounds([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    }
  }, []);

  const renderLayers = (layersToRender: any[]) => {
    return layersToRender.map(layer => {
      if (layer.id === 'layer-copernicus-damage') {
        return (
          <React.Fragment key={layer.id}>
            <Source id={`${layer.id}-buildings-src`} type="geojson" data="/data/copernicus/builtUp.geojson">
              <MapLayer 
                id={`${layer.id}-buildings-viz`}
                type="fill"
                paint={{
                  'fill-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#e74c3c',
                    'Damaged', '#e67e22',
                    'Possibly damaged', '#f1c40f',
                    'No visible damage', '#2ecc71',
                    '#95a5a6'
                  ],
                  'fill-opacity': 0.8
                }}
              />
              <MapLayer 
                id={`${layer.id}-buildings-line`}
                type="line"
                paint={{
                  'line-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#c0392b',
                    'Damaged', '#d35400',
                    'Possibly damaged', '#f39c12',
                    'No visible damage', '#27ae60',
                    '#7f8c8d'
                  ],
                  'line-width': 2,
                  'line-opacity': 1
                }}
              />
              <MapLayer 
                id={`${layer.id}-buildings-point-viz`}
                type="circle"
                filter={['==', ['geometry-type'], 'Point']}
                paint={{
                  'circle-radius': 5,
                  'circle-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#c0392b',
                    'Damaged', '#d35400',
                    'Possibly damaged', '#f39c12',
                    'No visible damage', '#27ae60',
                    '#7f8c8d'
                  ],
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff'
                }}
              />
            </Source>
            <Source id={`${layer.id}-roads-src`} type="geojson" data="/data/copernicus/transportation.geojson">
              <MapLayer 
                id={`${layer.id}-roads-viz`}
                type="line"
                paint={{
                  'line-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#c0392b',
                    'Damaged', '#d35400',
                    'Possibly damaged', '#f39c12',
                    'No visible damage', '#686868',
                    '#686868'
                  ],
                  'line-width': 3,
                  'line-opacity': 0.8
                }}
              />
              <MapLayer 
                id={`${layer.id}-roads-inner-viz`}
                type="line"
                paint={{
                  'line-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#e74c3c',
                    'Damaged', '#e67e22',
                    'Possibly damaged', '#f1c40f',
                    [
                      'match',
                      ['get', 'simplified'],
                      'Highway', '#ffbebe',
                      'Main road', '#ffffff',
                      'Local road', '#b2b2b2',
                      'Track', '#b2b2b2',
                      '#b2b2b2'
                    ]
                  ],
                  'line-width': 1.5,
                  'line-opacity': 1,
                  'line-dasharray': [
                    'match',
                    ['get', 'simplified'],
                    'Track', ['literal', [4, 2]],
                    ['literal', [1]]
                  ]
                }}
              />
              <MapLayer 
                id={`${layer.id}-roads-poly-viz`}
                type="fill"
                filter={['==', ['geometry-type'], 'Polygon']}
                paint={{
                  'fill-color': [
                    'match',
                    ['get', 'damage_gra'],
                    'Destroyed', '#c0392b',
                    'Damaged', '#d35400',
                    'Possibly damaged', '#f39c12',
                    'No visible damage', '#27ae60',
                    '#7f8c8d'
                  ],
                  'fill-opacity': 0.7
                }}
              />
              <MapLayer 
                id={`${layer.id}-roads-poly-outline-viz`}
                type="line"
                filter={['==', ['geometry-type'], 'Polygon']}
                paint={{
                  'line-color': '#fff',
                  'line-width': 1,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          </React.Fragment>
        );
      }
      
      let sourceUrl = '/data/earthquakes.geojson';
      let color = layer.visualization?.color || '#e74c3c';
      
      if (layer.id === 'layer-funvisis') {
        sourceUrl = '/data/funvisis-earthquakes.geojson';
      } else if (layer.id === 'layer-hospitals') {
        sourceUrl = '/data/hospitals.geojson';
      } else if (layer.id === 'layer-faults') {
        sourceUrl = '/data/faults.geojson';
      } else if (layer.id === 'layer-geologic-units') {
        sourceUrl = '/data/geologic_units.geojson';
      } else if (layer.id === 'layer-copernicus-ground-movement') {
        sourceUrl = '/data/copernicus/groundMovement.geojson';
      } else if (layer.id === 'layer-citizen-reports') {
        sourceUrl = '/data/citizen-reports.geojson';
      }
      
      const isRaster = layer.visualization?.type === 'raster';
      if (isRaster) {
        return (
          <Source key={layer.id} id={layer.id} type="raster" tiles={[layer.visualization.url]} tileSize={256}>
            <MapLayer
              id={`${layer.id}-viz`}
              type="raster"
              paint={{
                'raster-opacity': 1
              }}
            />
          </Source>
        );
      }

      const isLine = layer.visualization?.type === 'line';
      const isFill = layer.visualization?.type === 'fill';
      const isSymbol = layer.visualization?.type === 'symbol';
      const isCircle = layer.visualization?.type === 'point' || (!isLine && !isFill && !isSymbol);

      const circleRadius = (layer.id === 'layer-hospitals' || layer.id === 'layer-citizen-reports') ? 5 : [
        'interpolate',
        ['exponential', 2],
        ['get', 'mag'],
        0, 0,
        2, 4,
        4, 10,
        6, 25,
        8, 50
      ];

      const isNasaLayer = layer.id === 'layer-nasa-sentinel-damage';
      
      const sourceProps = isNasaLayer 
        ? { type: 'geojson' as const, data: nasaFeatures }
        : { type: 'geojson' as const, data: sourceUrl };

      const isPlateBoundary = [
        "any",
        ["==", ["get", "slip_type"], "Subduction_Thrust"],
        ["==", ["get", "slip_type"], "Dextral_Transform"],
        [">", ["index-of", "OCA", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "ANCON", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "ANCÓN", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "SEBASTIAN", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "SEBASTIÁN", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "PILAR", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "BOCONO", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "BOCONÓ", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "MARTA", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "BUCARAMANGA", ["upcase", ["coalesce", ["get", "name"], ""]]], -1],
        [">", ["index-of", "CARIBBEAN", ["upcase", ["coalesce", ["get", "name"], ""]]], -1]
      ];

      if (unavailableLayerIds.has(layer.id)) {
        return null;
      }

      return (
        <Source key={layer.id} id={layer.id} {...sourceProps}>
          {isFill && (
            <MapLayer 
              id={`${layer.id}-viz`}
              type="fill"
              paint={{
                'fill-color': layer.id === 'layer-geologic-units' ? 
                  [
                    'case',
                    ['>', ['index-of', 'holocene', ['downcase', ['get', 'Age']]], -1], '#fff6bf',
                    ['>', ['index-of', 'pleistocene', ['downcase', ['get', 'Age']]], -1], '#fff6bf',
                    ['>', ['index-of', 'pliocene', ['downcase', ['get', 'Age']]], -1], '#f8c97a',
                    ['>', ['index-of', 'miocene', ['downcase', ['get', 'Age']]], -1], '#f8c97a',
                    ['>', ['index-of', 'oligocene', ['downcase', ['get', 'Age']]], -1], '#efd96e',
                    ['>', ['index-of', 'eocene', ['downcase', ['get', 'Age']]], -1], '#efd96e',
                    ['>', ['index-of', 'paleocene', ['downcase', ['get', 'Age']]], -1], '#efd96e',
                    ['>', ['index-of', 'tertiary', ['downcase', ['get', 'Age']]], -1], '#efd96e',
                    ['>', ['index-of', 'cretaceous', ['downcase', ['get', 'Age']]], -1], '#a8d08d',
                    ['>', ['index-of', 'jurassic', ['downcase', ['get', 'Age']]], -1], '#8fb9e3',
                    ['>', ['index-of', 'permian', ['downcase', ['get', 'Age']]], -1], '#c59bd6',
                    ['>', ['index-of', 'proterozoic', ['downcase', ['get', 'Age']]], -1], '#e8b6d9',
                    ['>', ['index-of', 'archean', ['downcase', ['get', 'Age']]], -1], '#d98aa8',
                    '#dcdcdc'
                  ] : layer.id === 'layer-copernicus-ground-movement' ?
                  [
                    'match',
                    ['get', 'value'],
                    '-0.5 to -0.2', '#4062ab',
                    '-0.2 to -0.1', '#6aa1cb',
                    '-0.1 to -0.05', '#a4d3e6',
                    '-0.05 to 0', '#def2f7',
                    '0 to 0.05', '#fede8e',
                    '0.05 to 0.1', '#fca65d',
                    '0.1 to 0.2', '#ee603d',
                    '0.2 to 0.5', '#c82227',
                    'Above 0.5', '#a50026',
                    '#8b4513'
                  ] : layer.id === 'layer-nasa-sentinel-damage' ?
                  [
                    'step',
                    ['get', 'damage_probability'],
                    '#ffff73',
                    0.25, '#ffff73',
                    0.5, '#ff5500',
                    0.75, '#e60000'
                  ] : color,
                'fill-opacity': layer.id === 'layer-geologic-units' ? 0.2 : 
                                layer.id === 'layer-copernicus-ground-movement' ? 0.85 : 
                                layer.id === 'layer-nasa-sentinel-damage' ? 0.6 : 0.4
              }}
            />
          )}
          {isFill && layer.id !== 'layer-geologic-units' && layer.id !== 'layer-copernicus-ground-movement' && layer.id !== 'layer-nasa-sentinel-damage' && (
            <MapLayer 
              id={`${layer.id}-line`}
              type="line"
              paint={{
                'line-color': ['coalesce', ['get', 'color'], color],
                'line-width': 1,
                'line-opacity': 0.8
              }}
            />
          )}
          {isLine && (
            <MapLayer 
              id={`${layer.id}-viz`}
              type="line"
              paint={{
                'line-color': layer.id === 'layer-faults' ? [
                  'case',
                  isPlateBoundary, '#e74c3c',
                  color
                ] : color,
                'line-width': layer.id === 'layer-faults' ? [
                  'case',
                  isPlateBoundary, 3,
                  2
                ] : 2,
                'line-opacity': 0.8
              }}
            />
          )}
          {isLine && layer.id === 'layer-faults' && imagesLoaded && (
            <MapLayer
              id={`${layer.id}-symbols`}
              type="symbol"
              layout={{
                'symbol-placement': 'line',
                'symbol-spacing': 50,
                'icon-image': [
                  'case',
                  isPlateBoundary,
                  [
                    'match',
                    ['get', 'slip_type'],
                    ['Subduction_Thrust', 'Reverse', 'Reverse-Sinistral', 'Reverse-Dextral', 'Sinistral-Reverse', 'Dextral-Reverse'], 'fault-reverse-red',
                    ['Normal', 'Normal-Dextral', 'Dextral-Normal', 'Normal-Sinistral'], 'fault-normal-red',
                    ['Dextral', 'Sinistral', 'Dextral_Transform'], 'fault-strike-slip-red',
                    'fault-reverse-red'
                  ],
                  [
                    'match',
                    ['get', 'slip_type'],
                    ['Subduction_Thrust', 'Reverse', 'Reverse-Sinistral', 'Reverse-Dextral', 'Sinistral-Reverse', 'Dextral-Reverse'], 'fault-reverse',
                    ['Normal', 'Normal-Dextral', 'Dextral-Normal', 'Normal-Sinistral'], 'fault-normal',
                    ['Dextral', 'Sinistral', 'Dextral_Transform'], 'fault-strike-slip',
                    'fault-reverse'
                  ]
                ],
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-offset': [0, -6]
              }}
            />
          )}
          {isCircle && (
            <MapLayer 
              id={`${layer.id}-viz`}
              type="circle"
              paint={{
                'circle-color': layer.id === 'layer-citizen-reports' ? [
                  'match',
                  ['get', 'category'],
                  'missing_person', '#e74c3c',
                  'found_person', '#2ecc71',
                  'shelter', '#3498db',
                  'hospital', '#1abc9c',
                  'veterinary', '#f39c12',
                  color
                ] : color,
                'circle-radius': circleRadius as any,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
              }}
            />
          )}
        </Source>
      );
    });
  };

  const renderPopup = () => {
    if (!hoverInfo) return null;
    return (
      <Popup
        longitude={hoverInfo.longitude}
        latitude={hoverInfo.latitude}
        closeButton={false}
        closeOnClick={false}
        anchor="bottom"
        offset={15}
      >
        <div style={{ color: '#0f172a', padding: '4px', fontSize: '13px' }}>
          {hoverInfo.feature.properties.amenity === 'hospital' ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoverInfo.feature.properties.name || 'Unknown Hospital'}</div>
              <div style={{ color: '#475569' }}>Emergency: {hoverInfo.feature.properties.emergency === 'yes' ? 'Yes' : 'No / Unknown'}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                Source: {hoverInfo.feature.properties.source}
              </div>
            </>
          ) : hoverInfo.feature.properties.category ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoverInfo.feature.properties.name}</div>
              <div style={{ color: '#475569', textTransform: 'capitalize' }}>Category: {hoverInfo.feature.properties.category.replace('_', ' ')}</div>
              <div style={{ color: '#475569' }}>Status: {hoverInfo.feature.properties.status}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                <a href={hoverInfo.feature.properties.source} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                  Verify at original source ↗
                </a>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>
                * aggregated citizen report
              </div>
            </>
          ) : hoverInfo.feature.properties.obj_desc ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoverInfo.feature.properties.obj_desc}</div>
              {hoverInfo.feature.properties.value && (
                <div style={{ color: '#475569' }}>Value: {hoverInfo.feature.properties.value}</div>
              )}
            </>
          ) : hoverInfo.feature.properties.damage_gra ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>Assessment: {hoverInfo.feature.properties.damage_gra}</div>
              <div style={{ color: '#475569' }}>Type: {hoverInfo.feature.properties.obj_type}</div>
            </>
          ) : hoverInfo.feature.properties.damage_probability !== undefined ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>Damage Probability: {Math.round(hoverInfo.feature.properties.damage_probability * 100)}%</div>
              <div style={{ color: '#475569' }}>Class: {hoverInfo.feature.properties.class || 'Unknown'}</div>
            </>
          ) : hoverInfo.feature.properties.slip_type ? (
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoverInfo.feature.properties.slip_type}</div>
          ) : hoverInfo.feature.properties.Unit_name ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoverInfo.feature.properties.Unit_name}</div>
              <div style={{ color: '#475569' }}>Lithology: {hoverInfo.feature.properties.Lithology}</div>
              <div style={{ color: '#475569' }}>Age: {hoverInfo.feature.properties.Age}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>Magnitude {hoverInfo.feature.properties.mag}</div>
              <div style={{ color: '#475569' }}>{hoverInfo.feature.properties.place}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                {hoverInfo.feature.properties.time ? new Date(hoverInfo.feature.properties.time).toLocaleString() : 'Unknown Date'}
              </div>
              {hoverInfo.feature.properties.source && (
                <div style={{ color: '#64748b', fontSize: '11px' }}>
                  Source: {hoverInfo.feature.properties.source}
                </div>
              )}
            </>
          )}
        </div>
      </Popup>
    );
  };


  const getInteractiveIds = (layersToRender: any[]) => {
    return layersToRender.flatMap(l => {
      const ids = [`${l.id}-viz`];
      if (l.id === 'layer-copernicus-damage') {
        ids.push(`${l.id}-buildings-viz`, `${l.id}-buildings-point-viz`, `${l.id}-roads-viz`, `${l.id}-roads-poly-viz`);
      }
      return ids;
    });
  };

  return (
    <div className="map-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        mapLib={maplibregl as any}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        onMoveEnd={onMapMoveEnd}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        interactiveLayerIds={[
          ...getInteractiveIds(activeLayersWithData),
          ...(showEonet ? [EONET_LAYER_ID] : []),
        ]}
        onClick={onHover}
        onMouseMove={(e) => {
          const { features } = e as any;
          if (features && features.length) {
            e.target.getCanvas().style.cursor = 'pointer';
          } else {
            e.target.getCanvas().style.cursor = '';
          }
        }}
        onMouseLeave={(e) => {
          e.target.getCanvas().style.cursor = '';
        }}
        onLoad={onMapLoad}
        style={{ width: '100%', height: '100%' }}
      >
        {renderLayers(activeLayersWithData)}
        {showEonet && (
          <EonetLayer
            features={eonetFeatures}
            visibleEpoch={eonetVisibleEpoch}
            activeCategories={eonetActiveCategories}
          />
        )}
        {renderPopup()}
      </Map>
      {nasaLoading && activeLayerIds.has('layer-nasa-sentinel-damage') && (
        <div style={{
          position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.7)',
          color: 'white', padding: '8px 16px', borderRadius: '4px', fontSize: '12px'
        }}>
          Loading NASA Data...
        </div>
      )}
      <CopernicusLegend activeLayerIds={activeLayerIds} />
    </div>
  );
}

