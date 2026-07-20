import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import {
  EMPTY_EARTHQUAKES,
  normalizeEarthquakeSource,
  toEarthquakeRenderCollection,
  type EarthquakeFeatureCollection,
  type EarthquakeSource,
} from '../lib/earthquakes';

export interface UseGeofonEarthquakesResult {
  collection: EarthquakeFeatureCollection;
  loading: boolean;
  error: string | null;
  source: EarthquakeSource;
}

/**
 * Fetch GEOFON earthquakes from the gateway `/api/geofon/earthquakes` route for a
 * bbox (country registry) and start date (timeline window).
 */
export function useGeofonEarthquakes(
  enabled: boolean,
  bbox: string | undefined,
  start: string,
): UseGeofonEarthquakesResult {
  const [collection, setCollection] = useState<EarthquakeFeatureCollection>(EMPTY_EARTHQUAKES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<EarthquakeSource>(null);

  useEffect(() => {
    if (!enabled) {
      setCollection(EMPTY_EARTHQUAKES);
      setSource(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (bbox) params.set('bbox', bbox);
      if (start) params.set('start', start);
      try {
        const res = await fetch(`${API_BASE}/api/geofon/earthquakes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(toEarthquakeRenderCollection(body));
        setSource(normalizeEarthquakeSource(res.headers.get('X-GEOFON-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY_EARTHQUAKES);
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load GEOFON earthquakes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, bbox, start]);

  return { collection, loading, error, source };
}
