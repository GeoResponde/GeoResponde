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
 * A single NASA ARIA FeatureServer attached to an event (Phase 15, ND-02). `key`
 * is the route product slug (e.g. `'dpm'`) — the fixed, allowlisted literal the
 * gateway route accepts, never interpolated. `url` is the anonymous public AGOL
 * FeatureServer *layer* endpoint (`.../FeatureServer/0`). `where` is the
 * MANDATORY server-side filter (`damage=1`) the gateway always applies so it
 * never fetches all ~2.7M polygons (ND-03). `outFields` is the reduced attribute
 * set requested to keep the payload small (`damage_probability,label`).
 */
export interface NasaFeatureServer {
  key: string;
  label: string;
  url: string;
  where: string;
  outFields?: string;
}

/**
 * The NASA ARIA layer block for an event (Phase 15, ND-02/ND-06). `attribution`
 * and `disclaimer` are the verbatim strings surfaced on every DPM response header
 * (`X-Attribution` / `X-Damage-Disclaimer`) and in the map legend — the DPM is an
 * experimental, unvalidated product and both credits are mandatory. Adding a
 * disaster's DPM is purely config: drop a `nasa` block on its event key with the
 * anonymous AGOL FeatureServer url (this IS the "config-driven, anonymous AGOL"
 * discovery of NASA-01; AGOL search auto-discovery is deferred).
 */
export interface NasaEventLayers {
  attribution: string;
  disclaimer: string;
  featureServers: NasaFeatureServer[];
}

/**
 * A single disaster event. `country` is an iso2 key into {@link COUNTRY_BBOX}
 * (so the event composes with the country registry); `copernicus` is optional
 * because not every future event will have an EMS activation.
 *
 * `nasa` is the Phase 15 extension: the D-11 boundary Phase 14 deliberately left
 * out is now lifted — an event can carry a NASA ARIA layer block (currently the
 * DPM FeatureServer). It stays optional because not every event has ARIA
 * coverage. No imageServer/interferogram field is added here: that is Phase 16
 * (NASA-03), out of scope.
 */
export interface DisasterEvent {
  id: string;
  title: string;
  country: string;
  copernicus?: CopernicusActivation;
  nasa?: NasaEventLayers;
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
    // NASA ARIA "Likelihood of Damaged Structures" (DPM). The url is the
    // anonymous, public AGOL FeatureServer layer — this is the config-driven,
    // anonymous-AGOL discovery of NASA-01 (adding a disaster's DPM = drop this
    // block on its event key; AGOL search auto-discovery is deferred). `where`
    // is the mandatory server-side filter so the gateway never fetches all
    // ~2.7M polygons, only the ~58,870 damaged ones (ND-03).
    nasa: {
      attribution:
        'ARIA / NASA-JPL / Caltech, contains modified Copernicus Sentinel-1 data (ESA). Building footprints © Overture Maps Foundation.',
      disclaimer: 'Experimental — not validated for operational use.',
      featureServers: [
        {
          key: 'dpm',
          label: 'Likelihood of Damaged Structures (DPM)',
          url: 'https://services7.arcgis.com/WSiUmUhlFx4CtMBB/arcgis/rest/services/202610_s1_likelydmgareas/FeatureServer/0',
          where: 'damage=1',
          outFields: 'damage_probability,label',
        },
      ],
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
