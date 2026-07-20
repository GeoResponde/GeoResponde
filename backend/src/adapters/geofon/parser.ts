import type { EarthquakeFeatureCollection, EarthquakeFeature } from '@georesponde/shared';

/**
 * Parses the FDSNWS Event format=text pipe-delimited output from GEOFON
 * and normalizes it into our shared GeoJSON EarthquakeFeatureCollection.
 */
export function toEarthquakeCollection(textFormat: string): EarthquakeFeatureCollection {
  const lines = textFormat.split('\n');
  const features: EarthquakeFeature[] = [];

  // Start from line 1 to skip the header:
  // #EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split('|');
    if (parts.length < 13) continue;

    const [
      eventId,
      timeStr,
      latStr,
      lonStr,
      depthStr,
      _author,
      _catalog,
      _contributor,
      _contributorId,
      _magType,
      magStr,
      _magAuthor,
      eventLocationName
    ] = parts;

    const time = new Date(timeStr).getTime();
    if (isNaN(time)) continue;

    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (isNaN(lat) || isNaN(lon)) continue;

    // FDSN returns depth in km.
    const depth = Number(depthStr);
    const mag = Number(magStr);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          lon,
          lat
        ],
      },
      properties: {
        id: eventId,
        mag: isNaN(mag) ? 0 : mag,
        place: eventLocationName || 'Unknown',
        time,
        url: `https://geofon.gfz-potsdam.de/eqinfo/event.php?id=${eventId}`,
        depth: isNaN(depth) ? undefined : depth,
        source: 'GEOFON',
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
