import { useEffect, useState } from 'react';
import { bboxToEonetParam } from '@georesponde/shared';
import { API_BASE } from '../lib/api';
import { toRenderCollection, type RenderFeature, type RenderFeatureCollection } from '../lib/eonet';

/** Live/cache indicator surfaced by the gateway's `X-EONET-Source` header. */
export type EonetSource = 'live' | 'cache' | 'empty' | null;

export interface UseEonetEventsResult {
  collection: RenderFeatureCollection;
  features: RenderFeature[];
  loading: boolean;
  error: string | null;
  source: EonetSource;
}

const EMPTY: RenderFeatureCollection = { type: 'FeatureCollection', features: [] };

function normalizeSource(raw: string | null): EonetSource {
  return raw === 'live' || raw === 'cache' || raw === 'empty' ? raw : null;
}

/**
 * Fetch EONET events from the Phase 12 gateway for a country (bbox), a set of
 * categories, and a start date (the shared timeline window). Mirrors Find's
 * fetch shape and useCatalog's loading/error state.
 *
 * `start` (YYYY-MM-DD) constrains the fetch to RECENT events; passing
 * `undefined` requests all history (the opt-in "Histórico" window). Re-fetches
 * whenever `iso2`, the joined category string, or `start` changes. Network
 * failures set `error` and leave an empty collection — the hook never throws.
 */
export function useEonetEvents(
  iso2: string,
  categories: string[],
  start?: string,
): UseEonetEventsResult {
  const [collection, setCollection] = useState<RenderFeatureCollection>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<EonetSource>(null);

  // Depend on the joined string (not the array identity) so a new array literal
  // on every render does not re-trigger the effect.
  const categoryKey = categories.join(',');
  const startKey = start ?? '';

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ status: 'all' });
      const bbox = bboxToEonetParam(iso2);
      if (bbox) params.set('bbox', bbox);
      if (categoryKey) params.set('category', categoryKey);
      if (startKey) params.set('start', startKey);

      try {
        const res = await fetch(`${API_BASE}/api/eonet/events?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(toRenderCollection(body));
        setSource(normalizeSource(res.headers.get('X-EONET-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY);
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load EONET events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [iso2, categoryKey, startKey]);

  return { collection, features: collection.features, loading, error, source };
}
