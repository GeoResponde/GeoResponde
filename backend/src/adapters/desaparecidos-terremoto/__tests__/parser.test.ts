import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { filterAndNormalizePlataformas } from '../parser.js';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/plataformas.json'), 'utf-8'),
);

describe('DesaparecidosTerremoto parser', () => {
  it('filters and normalizes items that match the query', () => {
    const results = filterAndNormalizePlataformas(fixture, 'psicosocial');

    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.provider).toBe('Desaparecidos Terremoto VE');
    expect(first.type).toBe('resource');
    expect(first.status).toBe('active');
    expect(first.provider_id).toBe('plat-13');
    expect(first.title).toBe('PsicoLínea Venezuela (UCAB)');
    expect(first.subtitle).toContain('Apoyo psicosocial · ');
    expect(first.metadata?.categoria).toBe('Apoyo psicosocial');
    expect(first.last_update).toBe(new Date(1782652995392).toISOString());
    // url is null in the fixture → falls back to the canonical site.
    expect(first.url).toBe('https://desaparecidosterremotovenezuela.com/');
  });

  it('uses the provided url when present', () => {
    const results = filterAndNormalizePlataformas(fixture, 'venemergencia');
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://www.instagram.com/venemergencia');
  });

  it('returns every item (capped) when the query is empty', () => {
    const results = filterAndNormalizePlataformas(fixture, '');
    expect(results).toHaveLength(fixture.length);
    expect(results.length).toBeLessThanOrEqual(25);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterAndNormalizePlataformas(fixture, 'zzz-no-match')).toEqual([]);
  });
});
