import * as cheerio from 'cheerio';
import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper } from '../person.js';

const PERSONA_PREFIX = 'https://reencuentra-ve.vercel.app/persona/';

const toStatus = makeStatusMapper({
  desaparecido: 'missing',
  encontrado: 'found',
  hospitalizado: 'hospitalized',
  'a salvo': 'safe',
});

/** Extract the first "NN años" age mention from free-text metadata spans. */
function extractAge(info: string[]): number | undefined {
  for (const text of info) {
    const m = text.match(/(\d{1,3})\s*a[ñn]os/i);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/**
 * Pure parser for Reencuentra Venezuela search results.
 *
 * The site (https://reencuentra-ve.vercel.app/buscar?q=...) has no public JSON
 * API (its Supabase backend is closed), so results are read from the
 * server-rendered HTML. Each result is an `<a href="/persona/{uuid}">` card
 * containing the person's name, current status badge and free-text metadata
 * (age / municipality).
 *
 * Caveat: the `/buscar` page renders at most 20 cards. Real pagination happens
 * through a Next.js Server Action that is not part of the static HTML, so this
 * parser (and the adapter) only federate the first page of results.
 */
export function parseReencuentraHtml(html: string): NormalizedSearchResult[] {
  const $ = cheerio.load(html);
  const results: NormalizedSearchResult[] = [];

  $('a[href^="/persona/"]').each((_i, el) => {
    const $card = $(el);
    const href = $card.attr('href') || '';
    const id = href.replace(/^\/persona\//, '').trim();
    if (!id) return;

    const name = $card.find('h3.font-medium.truncate').first().text().trim();
    const estado = $card.find('span.rounded-full').first().text().trim();

    // Free-text metadata spans (age / municipality). They live in the
    // wrapping flex-wrap row, separate from the status badge.
    const info: string[] = [];
    $card.find('div.flex-wrap > span').each((_j, span) => {
      const text = $(span).text().trim();
      if (text) info.push(text);
    });

    results.push({
      provider: 'Reencuentra VE',
      provider_id: id,
      type: 'person',
      title: name,
      subtitle: info.join(' · ') || undefined,
      status: estado || undefined,
      url: PERSONA_PREFIX + id,
      person: {
        fullName: name || undefined,
        age: extractAge(info),
        status: toStatus(estado),
        rawStatus: estado || undefined,
        lastSeenLocation: info.join(', ') || undefined,
      },
      metadata: {},
    });
  });

  return results;
}
