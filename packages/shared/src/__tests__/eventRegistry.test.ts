import { describe, it, expect, afterEach } from 'vitest';
import {
  DISASTER_EVENTS,
  currentEventId,
  getEvent,
  bboxToEonetParam,
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
