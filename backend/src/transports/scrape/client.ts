import * as cheerio from 'cheerio';

/**
 * Generic HTML scraping transport. Fetches a page with a hard timeout and
 * returns a loaded Cheerio instance for structural traversal.
 *
 * Scraping is a last resort: prefer an official API or a JSON/XHR endpoint
 * whenever one exists (see CONTRIBUTING.md). Use this only when a provider
 * exposes no machine-readable data source.
 */
export async function fetchHtml(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<cheerio.CheerioAPI> {
  const { timeoutMs = 10000, headers = {} } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'GeoResponde-Gateway/1.0 (+https://georesponde.org)',
        ...headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Scrape transport responded with status: ${res.status}`);
    }

    const html = await res.text();
    return cheerio.load(html);
  } finally {
    clearTimeout(timeout);
  }
}
