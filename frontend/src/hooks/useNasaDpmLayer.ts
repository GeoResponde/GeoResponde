import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';

/**
 * Degrade-safe source reported by the gateway `X-Damage-Source` header.
 * `warming` means the gateway has not yet finished warming the full DPM set and
 * is filling it in the background — the layer will appear on a shortly-after
 * refetch (15-04).
 */
export type NasaDpmSource = 'live' | 'cache' | 'empty' | 'warming' | null;

/** A `[minLng,minLat,maxLng,maxLat]` viewport, matching the gateway `?bbox` order. */
export type NasaDpmBounds = [number, number, number, number];

/**
 * Loose damage FeatureCollection — the DPM carries arbitrary polygon geometry,
 * so this is NOT the Point-only earthquake type. Features are opaque; the
 * existing MapLibre `step` paint reads `damage_probability` directly.
 */
export interface NasaDpmFeatureCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

const EMPTY_DPM: NasaDpmFeatureCollection = { type: 'FeatureCollection', features: [] };

/** How long the gateway warm typically needs before a warming retry pays off. */
const WARMING_RETRY_MS = 4000;

export interface UseNasaDpmLayerResult {
  collection: NasaDpmFeatureCollection;
  loading: boolean;
  error: string | null;
  source: NasaDpmSource;
  attribution: string | null;
  disclaimer: string | null;
}

function normalizeSource(header: string | null): NasaDpmSource {
  return header === 'live' || header === 'cache' || header === 'empty' || header === 'warming'
    ? header
    : null;
}

/** Round a viewport to 4 decimals so tiny sub-pixel pans don't trigger refetches. */
function roundBounds(bounds: NasaDpmBounds): NasaDpmBounds {
  return bounds.map((n) => Math.round(n * 10000) / 10000) as NasaDpmBounds;
}

/**
 * Fetch the NASA ARIA "Likelihood of Damaged Structures" (DPM) layer from the
 * gateway `/api/damage/nasa/dpm` route, scoped to the current map viewport
 * (Phase 15 / 15-04). Only fetches while `enabled` (the layer toggle) is on.
 *
 * Viewport loading: `bounds` is the current map viewport as
 * `[minLng,minLat,maxLng,maxLat]`; it is passed through as `?bbox=` so the
 * gateway filters its warm in-memory set to just the polygons in view. A new
 * viewport refetches; the in-flight request is aborted on change/unmount and a
 * stale response (superseded by a newer request) is ignored.
 *
 * Warming: if the gateway reports `X-Damage-Source: warming` the full set is
 * still filling in the background — the hook keeps the (empty) layer, surfaces
 * `source: 'warming'` for a subtle indicator, and schedules ONE short refetch so
 * the layer appears once the cache warms. No crash, no request spam.
 *
 * Reads `X-Attribution`, `X-Damage-Disclaimer` and `X-Damage-Source` so the
 * legend can surface the mandatory ARIA/NASA/ESA/Overture credit AND the
 * "experimental, not validated" disclaimer (ND-06).
 */
export function useNasaDpmLayer(
  enabled: boolean,
  bounds?: NasaDpmBounds | null,
): UseNasaDpmLayerResult {
  const [collection, setCollection] = useState<NasaDpmFeatureCollection>(EMPTY_DPM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<NasaDpmSource>(null);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  // Monotonic request id so a slow earlier response can never overwrite a newer
  // one (viewport panning fires many overlapping fetches).
  const requestSeq = useRef(0);

  // Serialize bounds into a stable key so the effect only re-runs on a real
  // viewport change, not on every render's fresh array identity.
  const boundsKey = enabled && bounds ? roundBounds(bounds).join(',') : '';

  useEffect(() => {
    if (!enabled) {
      setCollection(EMPTY_DPM);
      setSource(null);
      setError(null);
      setAttribution(null);
      setDisclaimer(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    let warmTimer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const url = boundsKey
          ? `${API_BASE}/api/damage/nasa/dpm?bbox=${encodeURIComponent(boundsKey)}`
          : `${API_BASE}/api/damage/nasa/dpm`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
        const body = await res.json();
        // Ignore a response that a newer request has already superseded.
        if (cancelled || seq !== requestSeq.current) return;
        const nextSource = normalizeSource(res.headers.get('X-Damage-Source'));
        setCollection(
          body && body.type === 'FeatureCollection' && Array.isArray(body.features)
            ? (body as NasaDpmFeatureCollection)
            : EMPTY_DPM,
        );
        setSource(nextSource);
        setAttribution(res.headers.get('X-Attribution'));
        setDisclaimer(res.headers.get('X-Damage-Disclaimer'));
        // Still warming: the gateway is filling the full set in the background.
        // Schedule ONE short refetch (same request generation + AbortController)
        // so the layer appears once the cache warms, without spamming the route.
        if (nextSource === 'warming') {
          warmTimer = setTimeout(() => {
            if (!cancelled && seq === requestSeq.current) run();
          }, WARMING_RETRY_MS);
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        if (seq !== requestSeq.current) return;
        setCollection(EMPTY_DPM);
        setSource(null);
        setAttribution(null);
        setDisclaimer(null);
        setError(err instanceof Error ? err.message : 'Failed to load NASA DPM layer');
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      if (warmTimer) clearTimeout(warmTimer);
      controller.abort();
    };
  }, [enabled, boundsKey]);

  return { collection, loading, error, source, attribution, disclaimer };
}
