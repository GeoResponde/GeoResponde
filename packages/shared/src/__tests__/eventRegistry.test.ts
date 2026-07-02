import { describe, it, expect, afterEach } from 'vitest';
import {
  DISASTER_EVENTS,
  currentEventId,
  getEvent,
  bboxToEonetParam,
  COUNTRY_BBOX,
} from '../index.js';

const ENV_KEY = 'GR_CURRENT_EVENT';
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe('currentEventId — env selection', () => {
  it('defaults to the seeded event when GR_CURRENT_EVENT is unset', () => {
    delete process.env[ENV_KEY];
    expect(currentEventId()).toBe('ve-2026-quake');
  });

  it('honors GR_CURRENT_EVENT when set', () => {
    process.env[ENV_KEY] = 'some-other-event';
    expect(currentEventId()).toBe('some-other-event');
  });
});

describe('getEvent — lookup', () => {
  it('returns the current event when called with no argument', () => {
    delete process.env[ENV_KEY];
    const event = getEvent();
    expect(event?.id).toBe('ve-2026-quake');
  });

  it('resolves the seeded event to Copernicus activation EMSR884', () => {
    const event = getEvent('ve-2026-quake');
    expect(event).toBeDefined();
    expect(event?.copernicus?.activationId).toBe('EMSR884');
    expect(event?.copernicus?.attribution).toBe(
      '© European Union, 2026, Copernicus EMS (EMSR884)',
    );
  });

  it('returns undefined for an unregistered id (fail-closed)', () => {
    expect(getEvent('does-not-exist')).toBeUndefined();
  });
});

describe('registry composition', () => {
  it('exposes exactly one seeded event key', () => {
    expect(Object.keys(DISASTER_EVENTS)).toEqual(['ve-2026-quake']);
  });

  it("resolves the seeded event's country through the country registry", () => {
    const event = getEvent('ve-2026-quake');
    expect(event?.country).toBe('VE');
    expect(bboxToEonetParam(event!.country)).toBeDefined();
  });
});

describe('NASA ARIA DPM block (Phase 15)', () => {
  it('resolves the seeded event to a NASA block with exactly one dpm FeatureServer', () => {
    const event = getEvent('ve-2026-quake');
    expect(event?.nasa).toBeDefined();
    expect(event?.nasa?.featureServers).toHaveLength(1);
    expect(event?.nasa?.featureServers[0].key).toBe('dpm');
  });

  it('carries the DPM FeatureServer url and the mandatory damage=1 filter as config', () => {
    const dpm = getEvent('ve-2026-quake')!.nasa!.featureServers[0];
    expect(dpm.url).toContain('202610_s1_likelydmgareas/FeatureServer/0');
    // The mandatory server-side filter is config, never fetched-all (ND-03).
    expect(dpm.where).toBe('damage=1');
    expect(dpm.outFields).toBe('damage_probability,label');
    expect(dpm.label).toContain('DPM');
  });

  it('carries the mandatory ARIA/NASA/ESA/Overture attribution and experimental disclaimer', () => {
    const nasa = getEvent('ve-2026-quake')!.nasa!;
    expect(nasa.attribution).toContain('NASA-JPL');
    expect(nasa.attribution).toContain('Overture');
    expect(nasa.disclaimer).toContain('Experimental');
  });

  it('composes with the country registry so the adapter can reorder the bbox into an ArcGIS envelope', () => {
    const event = getEvent('ve-2026-quake')!;
    expect(COUNTRY_BBOX[event.country]).toBeDefined();
    // Stored W,N,E,S — the 15-02 adapter reorders this into the ArcGIS envelope.
    expect(COUNTRY_BBOX[event.country]).toEqual([-73.4, 12.2, -59.8, 0.6]);
  });
});
