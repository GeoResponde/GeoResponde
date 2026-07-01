import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { deserializeTurboStream } from '../../../transports/remix/deserializer.js';
import { parseVenezuelaTeBuscaStructural, normalizeRecord } from '../parser.js';

describe('VenezuelaTeBusca name cleaning', () => {
  it('keeps only the first name variant and de-duplicates the last name', () => {
    const r = normalizeRecord({
      id: 'abc',
      firstName: 'Marialejandra / Rodriguez Maria Alejandra / Rodriguez Marialejandra',
      lastName: 'Rodriguez',
    });
    expect(r.title).toBe('Marialejandra Rodriguez');
    expect(r.url).toBe('https://venezuelatebusca.com/?query=Marialejandra%20Rodriguez');
  });

  it('handles a normal name without variants', () => {
    const r = normalizeRecord({ id: 'x', firstName: 'Maria', lastName: 'Perez' });
    expect(r.title).toBe('Maria Perez');
  });

  it('falls back to Desconocido when no name is present', () => {
    const r = normalizeRecord({ id: 'y' });
    expect(r.title).toBe('Desconocido');
  });
});

describe('VenezuelaTeBusca Parser', () => {
  it('correctly parses complex structural TurboStream payloads', async () => {
    const fixturePath = path.join(__dirname, '../fixtures/yolis_root_data.txt');
    const data = fs.readFileSync(fixturePath);
    
    // Create a mock stream to feed into the deserializer
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });

    const deserialized = await deserializeTurboStream(stream);
    const results = parseVenezuelaTeBuscaStructural(deserialized);

    // Verify results exist
    expect(results.length).toBeGreaterThan(0);
    
    // Verify specific problem records were parsed!
    const mendoza = results.find((r: any) => r.title.includes('Mendoza'));
    expect(mendoza).toBeDefined();
    expect(mendoza?.title).toContain('Mendoza Méndez');
    
    // Verify another known record
    const yolismar = results.find((r: any) => r.title.includes('Yolismar'));
    expect(yolismar).toBeDefined();
    expect(yolismar?.title).toContain('Yolismar González');

    // Verify fields are correctly mapped
    if (mendoza) {
      expect(mendoza.provider).toBe('Venezuela Te Busca');
      expect(mendoza.provider_id).toBeDefined();
      expect(mendoza.status).toBeDefined();
      expect(mendoza.url).toContain('query=');
    }
  });
});
