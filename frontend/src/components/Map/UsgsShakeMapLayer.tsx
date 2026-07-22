import { Source, Layer } from 'react-map-gl/maplibre';

interface Props {
  data: any; // GeoJSON FeatureCollection
  globalTimeFilter?: [number, number] | null;
}

export function UsgsShakeMapLayer({ data, globalTimeFilter }: Props) {
  if (!data || !data.features || data.features.length === 0) {
    return null;
  }

  const timeFilter = globalTimeFilter
    ? ['all', ['>=', ['get', 'time'], globalTimeFilter[0]], ['<=', ['get', 'time'], globalTimeFilter[1]]]
    : undefined;

  return (
    <Source id="source-usgs-shakemap" type="geojson" data={data}>
      <Layer
        id="layer-usgs-shakemap-line"
        type="line"
        paint={{
          'line-color': ['coalesce', ['get', 'color'], '#ff9900'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 8, 3, 12, 5],
          'line-opacity': 0.8
        }}
        {...(timeFilter ? { filter: timeFilter as any } : {})}
      />
    </Source>
  );
}
