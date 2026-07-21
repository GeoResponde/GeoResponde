import { describe, it, expect } from 'vitest';
import { parseEstoyAquiVeResponse } from '../parser.js';
import buscarFixture from '../fixtures/buscar.json';
import foundFixture from '../fixtures/encontradas.json'

describe('EstoyAquiVe parser', () => {
  it('should parse missing persons (buscandas) correctly', () => {
    const results = parseEstoyAquiVeResponse(buscarFixture as any, null);

    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      provider: 'Estoy Aquí VE',
      provider_id: '00000000-0000-0000-0000-0000000000a1',
      type: 'person',
      title: 'Ana Prueba',
      subtitle: 'desaparecido',
      status: 'missing',
      url: 'https://estoyaquive.up.railway.app/',
    });

    expect(results[0].person).toMatchObject({
      fullName: 'Ana Prueba',
      cedula: 'V-12345678',
      age: 53,
      status: 'missing',
      rawStatus: 'desaparecido',
      lastSeenLocation: 'Estado Ejemplo, Municipio Ficticio',
      description: 'desaparecido',
      photoUrl: 'https://estoyaquive.up.railway.app/uploads/ana_prueba.jpg',
    });

    expect(results[0].person?.contact).toMatchObject({
      name: 'Juan Ejemplo',
      phone: '+58-412-123-4567',
    });

    expect(results[0].metadata).toMatchObject({
      reportedBy: 'Juan Ejemplo',
      reportDate: '2026-07-01T10:00:00Z',
    });
  });

  it('should parse found persons (encontradas) correctly', () => {
    const results = parseEstoyAquiVeResponse(null, foundFixture as any);

    expect(results[0]).toMatchObject({
      provider: 'Estoy Aquí VE',
      provider_id: '00000000-0000-0000-0000-0000000000b1',
      type: 'person',
      title: 'Pedro Encontrado',
      subtitle: 'Altura media, cabello oscuro',
      status: 'found',
      url: 'https://estoyaquive.up.railway.app/',
    });

    expect(results[0].person).toMatchObject({
      fullName: 'Pedro Encontrado',
      cedula: 'V-11223344',
      age: 45,
      status: 'found',
      rawStatus: 'estable',
      lastSeenLocation: 'Hospital Central de Ejemplo',
      description: 'Altura media, cabello oscuro',
      photoUrl: 'https://estoyaquive.up.railway.app/uploads/pedro_encontrado.jpg',
    });

    expect(results[0].metadata).toMatchObject({
      reportedBy: 'Dr. Test',
      reportDate: '2026-07-03T08:00:00Z',
      healthStatus: 'estable',
    });
  });

  it('should handle missing photo filename', () => {
    const results = parseEstoyAquiVeResponse(buscarFixture as any, foundFixture as any);
    expect(results[1].thumbnail).toBeUndefined();
    expect(results[1].person?.photoUrl).toBeUndefined();
  });

  it('should handle empty or malformed inputs', () => {
    expect(parseEstoyAquiVeResponse(null, null)).toEqual([]);
    expect(parseEstoyAquiVeResponse(undefined, undefined)).toEqual([]);
    expect(parseEstoyAquiVeResponse({} as any, {} as any)).toEqual([]);
    expect(parseEstoyAquiVeResponse({ buscandas: null } as any, { items: null } as any)).toEqual([]);
  });

  it('should handle empty arrays', () => {
    expect(parseEstoyAquiVeResponse({ buscandas: [] } as any, { items: [] } as any)).toEqual([]);
  });

  it('should parse both missing and found persons together', () => {
    const results = parseEstoyAquiVeResponse(buscarFixture as any, foundFixture as any);
    expect(results).toHaveLength(4);

    // Check that we have both types
    const missingPersons = results.filter(r => r.status === 'missing');
    const foundPersons = results.filter(r => r.status === 'found');

    expect(missingPersons).toHaveLength(2);
    expect(foundPersons).toHaveLength(2);
  });
});
