/**
 * {eventId -> disaster event} registry (Phase 14, seeds COP-01).
 *
 * The gateway serves ONE disaster at a time. Which one is a *data* choice, not a
 * code choice: this registry is the single source of truth mapping an event id to
 * its Copernicus EMS activation (and its country box, via {@link COUNTRY_BBOX}).
 * It is seeded now with the sole active event (`ve-2026-quake` -> `EMSR884`),
 * mirroring the `countryRegistry.ts` twin: "generalizable as data, not code".
 *
 * The active event is selected by the `GR_CURRENT_EVENT` env var, defaulting to
 * the seeded Venezuela earthquake. Adding a new disaster is therefore purely a
 * config change — drop in a new key here and set `GR_CURRENT_EVENT` — never a
 * route/handler edit. An unknown env value makes {@link getEvent} return
 * `undefined`, which the damage adapter treats as "no activation -> empty
 * collection" (fail-closed, never a crash).
 */

/**
 * A Copernicus EMS Rapid Mapping activation attached to an event. `activationId`
 * is the EMSR code (e.g. `'EMSR884'`); `attribution` is the verbatim EU credit
 * string mandated by Reg (EU) No 1159/2013, surfaced on every damage response
 * header and in the map legend.
 */
export interface CopernicusActivation {
  activationId: string;
  attribution: string;
}

/**
 * A single disaster event. `country` is an iso2 key into {@link COUNTRY_BBOX}
 * (so the event composes with the country registry); `copernicus` is optional
 * because not every future event will have an EMS activation.
 *
 * Deliberately NARROW for Phase 14: no NASA / imageServer fields here — those
 * belong to Phase 15/16 and are out of scope (D-11 boundary).
 */
export interface DisasterEvent {
  id: string;
  title: string;
  country: string;
  copernicus?: CopernicusActivation;
}

/**
 * {eventId -> event}. Seeded with exactly one key — the 2026 Venezuela
 * earthquake, Copernicus activation EMSR884, country VE. Adding a disaster =
 * drop in a new key + set `GR_CURRENT_EVENT`; no code edit anywhere else.
 */
export const DISASTER_EVENTS: Record<string, DisasterEvent> = {
  've-2026-quake': {
    id: 've-2026-quake',
    title: '2026 Venezuela Earthquake',
    country: 'VE',
    copernicus: {
      activationId: 'EMSR884',
      attribution: '© European Union, 2026, Copernicus EMS (EMSR884)',
    },
  },
};

/**
 * The id of the currently-served event. Read from `GR_CURRENT_EVENT`, defaulting
 * to the seeded `ve-2026-quake`. Flipping this env var (plus a matching registry
 * key) switches the whole gateway to a different disaster with no code change.
 */
export function currentEventId(): string {
  return process.env.GR_CURRENT_EVENT ?? 've-2026-quake';
}

/**
 * Look up an event by id, defaulting to the current event. Returns `undefined`
 * for an unregistered id — the consuming adapter treats that as "no activation"
 * and degrades to an empty collection (fail-closed).
 */
export function getEvent(id: string = currentEventId()): DisasterEvent | undefined {
  return DISASTER_EVENTS[id];
}
