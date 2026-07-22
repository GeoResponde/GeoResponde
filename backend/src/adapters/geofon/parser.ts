import { XMLParser } from 'fast-xml-parser';
import type { EarthquakeFeatureCollection, EarthquakeFeature } from '@georesponde/shared';

/**
 * Parses the FDSNWS Event format=xml (QuakeML) output from GEOFON
 * and normalizes it into our shared GeoJSON EarthquakeFeatureCollection.
 */
export function toEarthquakeCollection(xmlFormat: string): EarthquakeFeatureCollection {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const jsonObj = parser.parse(xmlFormat);
  const features: EarthquakeFeature[] = [];

  const quakeml = jsonObj['q:quakeml'] || jsonObj.quakeml;
  if (!quakeml) return { type: 'FeatureCollection', features };

  const eventParameters = quakeml.eventParameters;
  if (!eventParameters) return { type: 'FeatureCollection', features };

  let events = eventParameters.event;
  if (!events) return { type: 'FeatureCollection', features };
  if (!Array.isArray(events)) events = [events];

  for (const event of events) {
    const id = event['@_publicID']?.split('/').pop() || 'unknown';
    
    let descriptions = event.description;
    if (descriptions && !Array.isArray(descriptions)) descriptions = [descriptions];
    const place = descriptions?.[0]?.text || 'Unknown';

    // Get origin
    let origins = event.origin;
    if (!origins) continue;
    if (!Array.isArray(origins)) origins = [origins];
    const origin = origins[0];
    
    if (!origin) continue;
    
    const timeStr = origin.time?.value;
    const time = timeStr ? new Date(timeStr).getTime() : NaN;
    if (isNaN(time)) continue;

    const lat = Number(origin.latitude?.value);
    const lon = Number(origin.longitude?.value);
    if (isNaN(lat) || isNaN(lon)) continue;

    // QuakeML depth is in meters. We want km.
    const depthRaw = Number(origin.depth?.value);
    const depth = isNaN(depthRaw) ? undefined : depthRaw / 1000;

    // Get magnitude
    let magnitudes = event.magnitude;
    if (!magnitudes) magnitudes = [];
    if (!Array.isArray(magnitudes)) magnitudes = [magnitudes];
    const mag = Number(magnitudes[0]?.mag?.value);

    // Get focal mechanism if any
    let focal = event.focalMechanism;
    let nodalPlane1;
    if (focal) {
      if (Array.isArray(focal)) focal = focal[0];
      nodalPlane1 = focal.nodalPlanes?.nodalPlane1;
    }

    const feature: EarthquakeFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties: {
        id,
        mag: isNaN(mag) ? 0 : mag,
        place,
        time,
        url: `https://geofon.gfz-potsdam.de/eqinfo/event.php?id=${id}`,
        depth,
        source: 'GEOFON',
      },
    };

    if (nodalPlane1) {
      const strike = Number(nodalPlane1.strike?.value);
      const dip = Number(nodalPlane1.dip?.value);
      const rake = Number(nodalPlane1.rake?.value);
      if (!isNaN(strike) && !isNaN(dip) && !isNaN(rake)) {
        feature.properties.focalMechanism = { strike, dip, rake };
      }
    }

    features.push(feature);
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
