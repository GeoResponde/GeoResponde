import { describe, it, expect } from 'vitest';
import { parseCollectionCenters } from '../parser.js';
import { CentrosDeAcopioVzlaRoot } from '../types.js';

describe('CentrosDeAcopioVzla Parser', () => {
  const providerId = 'centros-de-acopio-vzla';

  it('should parse nested centers correctly', () => {
    const mockData: CentrosDeAcopioVzlaRoot = {
      estados: [
        {
          nombre: 'Anzoátegui',
          ciudades: [
            {
              nombre: 'Lechería',
              centros: [
                {
                  nombre: 'CC Forum Plaza - Lechería',
                  direccion: 'Centro Comercial Forum Plaza',
                  coords: [10.188, -64.68],
                  maps: 'https://maps.google.com/?q=10.188,-64.68',
                  contacto: '0414-1234567',
                  recibe: ['agua', 'comida'],
                  fuente: 'Twitter'
                }
              ]
            }
          ]
        }
      ]
    };

    const results = parseCollectionCenters(providerId, mockData);

    expect(results).toHaveLength(1);
    
    const center = results[0];
    expect(center.provider).toBe(providerId);
    expect(center.title).toBe('CC Forum Plaza - Lechería');
    expect(center.subtitle).toBe('Centro Comercial Forum Plaza');
    expect(center.address).toBe('Centro Comercial Forum Plaza, Lechería, Anzoátegui, Venezuela');
    expect(center.category).toBe('centro de acopio');
    expect(center.location).toEqual({ lat: 10.188, lng: -64.68 });
    expect(center.url).toBe('https://maps.google.com/?q=10.188,-64.68');
    
    expect(center.tags).toEqual(['agua', 'comida']);
    
    expect(center.metadata).toEqual({
      maps: 'https://maps.google.com/?q=10.188,-64.68',
      contacto: '0414-1234567',
      fuente: 'Twitter',
      ciudad: 'Lechería',
      estado: 'Anzoátegui'
    });
  });

  it('should handle missing fields gracefully', () => {
    const mockData: CentrosDeAcopioVzlaRoot = {
      estados: [
        {
          nombre: 'Lara',
          ciudades: [
            {
              nombre: 'Barquisimeto',
              centros: [
                {
                  nombre: 'Cruz Roja'
                }
              ]
            }
          ]
        }
      ]
    };

    const results = parseCollectionCenters(providerId, mockData);
    expect(results).toHaveLength(1);
    
    const center = results[0];
    expect(center.title).toBe('Cruz Roja');
    expect(center.address).toBe('Barquisimeto, Lara, Venezuela');
    expect(center.tags).toEqual([]);
    expect(center.location).toBeUndefined();
    expect(center.url).toBeUndefined();
  });

  it('should skip malformed or empty data', () => {
    // @ts-expect-error testing invalid input
    expect(parseCollectionCenters(providerId, null)).toEqual([]);
    
    expect(parseCollectionCenters(providerId, { estados: [] })).toEqual([]);
    
    // @ts-expect-error testing invalid input
    expect(parseCollectionCenters(providerId, { estados: [ { ciudades: null } ] })).toEqual([]);
  });
});
