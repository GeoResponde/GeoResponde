/**
 * Shared time-window presets for the Situation map. One window drives EONET,
 * USGS and FUNVISIS so the map defaults to RECENT activity (last 7 days) rather
 * than all-history. "Histórico" (all) is the opt-in wide window.
 */
export type TimePreset = 'today' | 'week' | 'month' | 'all';

/** Ordered presets for the selector. `all` is the opt-in historical window. */
export const TIME_PRESETS: TimePreset[] = ['today', 'week', 'month', 'all'];

/** Default window: recent events only (last 7 days). */
export const DEFAULT_TIME_PRESET: TimePreset = 'week';

/** Days back per preset used to compute a start date. `all` has no EONET bound. */
const PRESET_DAYS: Record<Exclude<TimePreset, 'all'>, number> = {
  today: 1,
  week: 7,
  month: 30,
};

/**
 * For the historical ("all") preset, earthquake feeds are still bounded to avoid
 * pulling years of global USGS data. One year is a safe, useful ceiling.
 */
const QUAKE_ALL_DAYS = 365;

/** Format an epoch as a UTC `YYYY-MM-DD` date string. */
function toIsoDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for `days` before now (UTC). */
function daysAgoIso(days: number): string {
  return toIsoDate(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Resolve a preset into concrete start dates:
 *  - `eonetStart`: `YYYY-MM-DD` for EONET's `start` param, or `undefined` for the
 *    historical window (no lower bound → status=all, all history);
 *  - `quakeStart`: `YYYY-MM-DD` for USGS/FUNVISIS `starttime`, always bounded
 *    (the historical window is capped to one year for the quake feeds).
 */
export function presetToWindow(preset: TimePreset): {
  eonetStart: string | undefined;
  quakeStart: string;
} {
  if (preset === 'all') {
    return { eonetStart: undefined, quakeStart: daysAgoIso(QUAKE_ALL_DAYS) };
  }
  const start = daysAgoIso(PRESET_DAYS[preset]);
  return { eonetStart: start, quakeStart: start };
}
