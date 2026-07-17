import { describe, it, expect } from 'vitest';
import { parseAjeResponse } from '../parser.js';
import centrosFixture from '../fixtures/search-centros.json';
import donacionesFixture from '../fixtures/search-donaciones.json';

describe('AjeAyudaVenezuela parser', () => {
  it('should parse centros de acopio correctly', () => {
    const results = parseAjeResponse(centrosFixture as any, null);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      provider: 'AJE Ayuda Venezuela',
      provider_id: '11111111-1111-1111-1111-111111111111',
      type: 'shelter',
      title: 'Centro de Acopio Universitario',
      subtitle: 'Norte',
      status: 'active',
      location: [-66.9, 10.48],
      last_update: '2026-07-10T12:00:00Z',
      url: 'https://ajevenezuela.org/ayuda-venezuela',
    });

    expect(results[0].metadata).toMatchObject({
      address: 'Av. Principal Universitaria',
      city: 'Caracas',
      zone: 'Norte',
      phone: '0414-1234567',
      items: ['Agua', 'Comida no perecedera'],
      verified: true,
    });

    // Second record has missing location and is inactive
    expect(results[1]).toMatchObject({
      status: 'inactive',
      location: undefined,
    });
  });

  it('should parse donaciones correctly', () => {
    const results = parseAjeResponse(null, donacionesFixture as any);
    expect(results).toHaveLength(1);

    expect(results[0]).toMatchObject({
      provider: 'AJE Ayuda Venezuela',
      provider_id: '33333333-3333-3333-3333-333333333333',
      type: 'other',
      title: 'Organización de Ayuda',
      subtitle: 'Médica',
      status: 'active',
      url: 'https://ayuda.org',
    });
  });

  it('should handle empty or malformed inputs', () => {
    expect(parseAjeResponse(null, null)).toEqual([]);
    expect(parseAjeResponse(undefined, undefined)).toEqual([]);
    expect(parseAjeResponse([] as any, [] as any)).toEqual([]);
  });

  it('should combine centros and donaciones', () => {
    const results = parseAjeResponse(
      centrosFixture as any,
      donacionesFixture as any
    );
    expect(results).toHaveLength(3);
  });
});
