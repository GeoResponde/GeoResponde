import { describe, it, expect } from 'vitest';
import { parseJuntosVeResponse } from '../parser.js';
import type { JuntosVeFeature } from '../types.js';

describe('JuntosVe Parser', () => {
  const providerId = 'prov-juntosve';

  it('normalizes a refugio point to a shelter', () => {
    const feature: JuntosVeFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-66, 10] },
      properties: {
        id: '123',
        type: 'refugio',
        status: 'activo',
        description: 'Centro 1',
        photo_url: 'img.jpg',
        people_count: null,
        capacity: 100,
        spots_available: 20,
        accepts: 'Water',
        created_at: '2026-06-27T14:41:54Z',
        updated_at: '2026-06-27T14:42:16Z',
        resolved_at: null,
      },
    };

    const res = parseJuntosVeResponse(feature, providerId);
    expect(res.provider).toBe('juntosVE');
    expect(res.provider_id).toBe('123');
    expect(res.type).toBe('shelter');
    expect(res.status).toBe('active');
    expect(res.title).toBe('Refugio / Centro de Acopio');
    expect(res.subtitle).toBe('Centro 1');
    expect(res.location).toEqual([-66, 10]);
    expect(res.metadata).toEqual({
      capacity: 100,
      spots_available: 20,
      accepts: 'Water',
    });
  });

  it('normalizes a rescate point to a request', () => {
    const feature: JuntosVeFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-67, 11] },
      properties: {
        id: '456',
        type: 'rescate',
        status: 'resuelto',
        description: 'Need help',
        photo_url: null,
        people_count: 5,
        capacity: null,
        spots_available: null,
        accepts: null,
        created_at: '2026-06-27T14:41:54Z',
        updated_at: '2026-06-28T14:42:16Z',
        resolved_at: '2026-06-28T14:42:16Z',
      },
    };

    const res = parseJuntosVeResponse(feature, providerId);
    expect(res.type).toBe('request');
    expect(res.status).toBe('inactive'); // mapped from resuelto
    expect(res.title).toBe('Solicitud de Ayuda (rescate)');
    expect(res.last_update).toBe('2026-06-28T14:42:16Z');
    expect(res.metadata).toEqual({
      people_count: 5,
    });
  });
});
