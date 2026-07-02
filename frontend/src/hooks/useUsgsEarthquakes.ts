import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import {
  EMPTY_EARTHQUAKES,
  normalizeEarthquakeSource,
  toEarthquakeRenderCollection,
  type EarthquakeFeatureCollection,
  type EarthquakeSource,
} from '../lib/earthquakes';

export interface UseUsgsEarthquakesResult {
  collection: EarthquakeFeatureCollection;
  loading: boolean;
  error: string | null;
  source: EarthquakeSource;
}

/**
 * Fetch USGS earthquakes from the gateway `/api/usgs/earthquakes` route for a
 * bbox (country registry) and start date (timeline window). Only fetches while
 * `enabled` (the layer toggle) is on and re-fetches when the bbox or window
 * changes. Network failures set `error` and leave an empty collection — the hook
 * never throws.
 */
export function useUsgsEarthquakes(
  enabled: boolean,
  bbox: string | undefined,
  start: string,
): UseUsgsEarthquakesResult {
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
        const res = await fetch(`${API_BASE}/api/usgs/earthquakes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(toEarthquakeRenderCollection(body));
        setSource(normalizeEarthquakeSource(res.headers.get('X-USGS-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY_EARTHQUAKES);
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load USGS earthquakes');
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
