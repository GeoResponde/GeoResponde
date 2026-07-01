import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

/** A Copernicus damage product slug served by the gateway. */
export type DamageProduct = 'grading' | 'ground-movement';

/** Degrade-safe source reported by the gateway `X-Damage-Source` header. */
export type DamageSource = 'live' | 'cache' | 'empty' | null;

/**
 * Loose damage FeatureCollection — grading carries Polygon/Line/Point geometry,
 * so this is NOT the Point-only earthquake type. Features are opaque; the
 * existing MapLibre paint reads their properties directly.
 */
export interface DamageFeatureCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

const EMPTY_DAMAGE: DamageFeatureCollection = { type: 'FeatureCollection', features: [] };

export interface UseDamageLayerResult {
  collection: DamageFeatureCollection;
  loading: boolean;
  error: string | null;
  source: DamageSource;
  attribution: string | null;
}

function normalizeSource(header: string | null): DamageSource {
  return header === 'live' || header === 'cache' || header === 'empty' ? header : null;
}

/**
 * Fetch a Copernicus damage product (`grading` -> GRA, `ground-movement` -> GRM)
 * from the gateway `/api/damage/copernicus/:product` route. Mirrors
 * `useUsgsEarthquakes`: only fetches while `enabled` (the layer toggle) is on,
 * aborts in-flight requests on cleanup, and never throws — a failure sets `error`
 * and leaves an empty collection. Reads the `X-Attribution` and `X-Damage-Source`
 * response headers so the legend can surface the EU/Copernicus credit (D-07).
 */
export function useDamageLayer(
  product: DamageProduct,
  enabled: boolean,
): UseDamageLayerResult {
  const [collection, setCollection] = useState<DamageFeatureCollection>(EMPTY_DAMAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DamageSource>(null);
  const [attribution, setAttribution] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCollection(EMPTY_DAMAGE);
      setSource(null);
      setError(null);
      setAttribution(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/damage/copernicus/${product}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(
          body && body.type === 'FeatureCollection' && Array.isArray(body.features)
            ? (body as DamageFeatureCollection)
            : EMPTY_DAMAGE,
        );
        setSource(normalizeSource(res.headers.get('X-Damage-Source')));
        setAttribution(res.headers.get('X-Attribution'));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY_DAMAGE);
        setSource(null);
        setAttribution(null);
        setError(err instanceof Error ? err.message : 'Failed to load damage layer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product, enabled]);

  return { collection, loading, error, source, attribution };
}
