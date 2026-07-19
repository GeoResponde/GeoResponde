import { describe, it, expect } from 'vitest';
import { parseVenezuelaRescateResponse } from '../parser.js';
import missingFixture from '../fixtures/missing.json';
import hospitalizedFixture from '../fixtures/hospitalized.json';

describe('VenezuelaRescate parser', () => {
  it('should parse missing correctly', () => {
    const results = parseVenezuelaRescateResponse(missingFixture as any, null);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      provider: 'Venezuela Rescate',
      provider_id: '81',
      type: 'person',
      title: 'Ana Prueba',
      subtitle: 'Última Ubicación: Alguna playa',
      status: 'missing',
      url: "https://venezuelarescate.com/buscar",
    });

    expect(results[0].person).toMatchObject({
      fullName: "Ana Prueba",
      status: "missing",
      rawStatus: "desaparecido",
      lastSeenLocation: "Alguna playa",
      photoUrl: "https://some_random_link.jpg",
    });

    expect(results[0].metadata).toMatchObject({
      createdAt: "2026-07-01T23:27:48+00:00"
    });

    // Second record has status found and is inactive
    expect(results[1]).toMatchObject({
      status: 'found',
    });
  });

  it('should parse hospitalized correctly', () => {
    const results = parseVenezuelaRescateResponse(null, hospitalizedFixture as any);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      provider: "Venezuela Rescate",
      provider_id: "7",
      type: "person",
      title: "Ana Prueba",
      subtitle: "",
      thumbnail: undefined,
      url: "https://venezuelarescate.com/pacientes-en-hospitales",
    });

    expect(results[0].person).toMatchObject({
      fullName: 'Ana Prueba',
      rawStatus: 'estable',
      photoUrl: undefined,
      isMinor: false,
      gender: 'male',
      hospital: 'Mi hospital',
      cedula: undefined,
      age: 29
    });

    expect(results[0].metadata).toMatchObject({
      batch_date: null,
      created_at: "2026-07-01T08:42:01-04:00",
      nicknames: "John Doe",
      source: "manual",
    })

    //Age becomes undefined when it can't be converted to number type
    expect(results[1].person).toMatchObject({
      age: undefined
    });

  });

  it('should handle empty or malformed inputs', () => {
    expect(parseVenezuelaRescateResponse(null, null)).toEqual([]);
    expect(parseVenezuelaRescateResponse(undefined, undefined)).toEqual([]);
    expect(parseVenezuelaRescateResponse([] as any, [] as any)).toEqual([]);
  });

  it('should combine missing and hospitalized', () => {
    const results = parseVenezuelaRescateResponse(
      missingFixture as any,
      hospitalizedFixture as any
    );
    expect(results).toHaveLength(4);
  });
});
