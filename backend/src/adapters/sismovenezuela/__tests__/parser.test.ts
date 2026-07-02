import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseSismoVenezuelaFeed,
  normalizeReport,
} from '../parser.js';

describe('SismoVenezuela Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/feed.json');
  const feed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  it('normalizes every report when no query is given', () => {
    const results = parseSismoVenezuelaFeed(feed);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.type === 'report')).toBe(true);
    expect(results.every((r) => r.provider === 'Sismo Venezuela')).toBe(true);
    // Crowdsourced reports are not people.
    expect(results.every((r) => r.person === undefined)).toBe(true);
  });

  it('filters client-side by text, location or author (case-insensitive)', () => {
    // Matches location_name "Caracas".
    expect(parseSismoVenezuelaFeed(feed, 'caracas')).toHaveLength(1);
    // Matches author "vecinoMerida" and location "Merida".
    const merida = parseSismoVenezuelaFeed(feed, 'merida');
    expect(merida).toHaveLength(1);
    expect(merida[0].provider_id).toBe('22222222-2222-2222-2222-222222222222');
    // Matches text_content of the first report.
    expect(parseSismoVenezuelaFeed(feed, 'colapso')).toHaveLength(1);
    // No match.
    expect(parseSismoVenezuelaFeed(feed, 'zzznomatch')).toHaveLength(0);
  });

  it('maps verified/unverified status', () => {
    const [caracas] = parseSismoVenezuelaFeed(feed, 'caracas');
    expect(caracas.status).toBe('verified');
    const [merida] = parseSismoVenezuelaFeed(feed, 'merida');
    expect(merida.status).toBe('unverified');
  });

  it('maps core fields and metadata', () => {
    const [caracas] = parseSismoVenezuelaFeed(feed, 'caracas');
    expect(caracas.title).toBe('Caracas');
    expect(caracas.subtitle).toContain('Colapso parcial');
    expect(caracas.url).toBe('https://www.youtube.com/watch?v=synthetic01');
    expect(caracas.thumbnail).toBe(
      'https://example.com/thumbs/caracas-edificio.jpg',
    );
    expect(caracas.last_update).toBe('2026-07-01T08:00:00+00:00');
    expect(caracas.location).toEqual([-66.9167, 10.5]);
    expect(caracas.metadata).toMatchObject({
      source: 'youtube',
      damage_level: 4,
      credibility: 'high',
      author: 'CanalNoticiasEjemplo',
    });
  });

  it('sanitizes out-of-range and null coordinates to undefined', () => {
    const [merida] = parseSismoVenezuelaFeed(feed, 'merida');
    expect(merida.location).toBeUndefined();
    const outOfRange = parseSismoVenezuelaFeed(feed)[2];
    expect(outOfRange.location).toBeUndefined();
  });

  it('falls back for missing title and url', () => {
    const empty = normalizeReport({
      id: 'x',
      text_content: '',
      source_url: '',
    });
    expect(empty.title).toBe('Reporte');
    expect(empty.subtitle).toBeUndefined();
    expect(empty.url).toBe('https://sismovenezuela.com/');
  });

  it('accepts { reports: [...] } and { data: [...] } wrappers', () => {
    expect(parseSismoVenezuelaFeed({ reports: feed })).toHaveLength(3);
    expect(parseSismoVenezuelaFeed({ data: feed })).toHaveLength(3);
  });

  it('returns an empty array for malformed responses', () => {
    expect(parseSismoVenezuelaFeed(null)).toEqual([]);
    expect(parseSismoVenezuelaFeed({})).toEqual([]);
    expect(parseSismoVenezuelaFeed({ reports: 'nope' })).toEqual([]);
  });

  it('caps results at 25', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `id-${i}`,
      text_content: 'sismo',
      scraped_at: '2026-07-01T00:00:00+00:00',
    }));
    expect(parseSismoVenezuelaFeed(many, 'sismo')).toHaveLength(25);
    expect(parseSismoVenezuelaFeed(many)).toHaveLength(25);
  });
});
