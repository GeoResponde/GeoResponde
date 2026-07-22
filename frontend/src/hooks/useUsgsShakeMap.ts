import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { normalizeEarthquakeSource, type EarthquakeSource } from '../lib/earthquakes';

export interface UseUsgsShakeMapResult {
  collection: any; // GeoJSON FeatureCollection
  loading: boolean;
  error: string | null;
  source: EarthquakeSource;
}

export function useUsgsShakeMap(
  enabled: boolean,
  bbox: string | undefined,
  start: string,
): UseUsgsShakeMapResult {
  const [collection, setCollection] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<EarthquakeSource>(null);

  useEffect(() => {
    if (!enabled) {
      setCollection({ type: 'FeatureCollection', features: [] });
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
        const res = await fetch(`${API_BASE}/api/usgs/shakemap?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(body);
        setSource(normalizeEarthquakeSource(res.headers.get('X-USGS-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection({ type: 'FeatureCollection', features: [] });
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load USGS ShakeMap');
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
