import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import {
  toAidSiteRenderCollection,
  type AidSiteRenderCollection,
  type AidSiteRenderFeature,
} from '../lib/sitios';

/** Live/cache indicator surfaced by the gateway's `X-Sitios-Source` header. */
export type SitiosSource = 'live' | 'cache' | 'empty' | null;

export interface UseAidSitesResult {
  features: AidSiteRenderFeature[];
  loading: boolean;
  error: string | null;
  source: SitiosSource;
}

const EMPTY: AidSiteRenderCollection = { type: 'FeatureCollection', features: [] };

function normalizeSource(raw: string | null): SitiosSource {
  return raw === 'live' || raw === 'cache' || raw === 'empty' ? raw : null;
}

/**
 * Fetch Venezuela Reporta aid sites from the gateway `/api/sitios` route,
 * mirroring `useEonetEvents`'s loading/error/source shape. Only fetches while
 * `enabled` (the layer toggle) is on. Network failures set `error` and leave an
 * empty list — the hook never throws.
 */
export function useAidSites(enabled: boolean): UseAidSitesResult {
  const [collection, setCollection] = useState<AidSiteRenderCollection>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SitiosSource>(null);

  useEffect(() => {
    if (!enabled) {
      setCollection(EMPTY);
      setSource(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/sitios`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setCollection(toAidSiteRenderCollection(body));
        setSource(normalizeSource(res.headers.get('X-Sitios-Source')));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setCollection(EMPTY);
        setSource(null);
        setError(err instanceof Error ? err.message : 'Failed to load aid sites');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  return { features: collection.features, loading, error, source };
}
