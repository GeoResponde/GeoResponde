import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import {
  EMPTY_EARTHQUAKES,
  normalizeEarthquakeSource,
  toEarthquakeRenderCollection,
  type EarthquakeFeatureCollection,
  type EarthquakeSource,
} from '../lib/earthquakes';

export interface UseFunvisisEarthquakesResult {
  collection: EarthquakeFeatureCollection;
  loading: boolean;
  error: string | null;
  source: EarthquakeSource;
}

/**
 * Fetch FUNVISIS earthquakes (via SismosVE) from the gateway
 * `/api/funvisis/earthquakes` route for a start date (timeline window). Only
 * fetches while `enabled` (the layer toggle) is on and re-fetches when the
 * window changes. Network failures set `error` and leave an empty collection —
 * the hook never throws. Attribution "FUNVISIS (vía SismosVE)" rides on the data.
 */
export function useFunvisisEarthquakes(
  enabled: boolean,
  start: string,
): UseFunvisisEarthquakesResult {
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
      if (start) params.set('start', start);
      try {
        const res = await fetch(`${API_BASE}/api/funvisis/earthquakes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(toEarthquakeRenderCollection(body));
        setSource(normalizeEarthquakeSource(res.headers.get('X-FUNVISIS-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY_EARTHQUAKES);
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load FUNVISIS earthquakes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, start]);

  return { collection, loading, error, source };
}
