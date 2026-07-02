import { NormalizedSearchResult } from '@georesponde/shared';

const PROVIDER_NAME = 'Hazlo Hoy Terremoto';
const SITE_ORIGIN = 'https://terremoto.hazlohoy.org';

/**
 * Maps a Hazlo Hoy marker `kind` to a normalized result `type`.
 */
function mapKindToType(kind: unknown): string {
  switch (kind) {
    case 'missing':
    case 'need':
      return 'person';
    case 'damaged':
      return 'building';
    case 'center':
      return 'collection_center';
    case 'helper':
      return 'resource';
    default:
      return 'marker';
  }
}

/**
 * Attempts to JSON.parse a candidate string, returning the parsed array or
 * `null` when it is not valid JSON / not an array.
 */
function tryParseArray(candidate: string): any[] | null {
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Escapes literal control characters (CR, LF, TAB) that appear unescaped inside
 * the RSC payload. The live stream embeds raw newlines/tabs inside string
 * values, which strict JSON.parse rejects.
 */
function escapeControlChars(input: string): string {
  return input.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

/**
 * Un-escapes a double-escaped RSC fragment (`\"` -> `"`, `\\` -> `\`). Some RSC
 * streams serialize the payload as an escaped string literal; in that case the
 * inner JSON only becomes parseable after this pass.
 */
function unescapeRsc(input: string): string {
  return input.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * PURE. Locates the JSON array that follows the `markers` key inside a raw RSC
 * (`text/x-component`) payload, extracts it by balancing `[` / `]`, and parses
 * it. Handles both the double-escaped form described by the RSC spec and the
 * live form (normal quotes with raw control characters). Returns `[]` on any
 * failure.
 */
export function extractMarkers(raw: string): any[] {
  try {
    if (!raw || typeof raw !== 'string') return [];

    const keyIdx = raw.indexOf('markers');
    if (keyIdx === -1) return [];

    const start = raw.indexOf('[', keyIdx);
    if (start === -1) return [];

    // Balance brackets to isolate the array substring.
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '[') {
        depth++;
      } else if (ch === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return [];

    const slice = raw.slice(start, end + 1);

    // Try progressively more aggressive normalizations:
    //  1. as-is (already valid JSON)
    //  2. escape raw control chars (live stream)
    //  3. un-escape a double-escaped fragment, then escape control chars (spec form)
    const parsed =
      tryParseArray(slice) ||
      tryParseArray(escapeControlChars(slice)) ||
      tryParseArray(escapeControlChars(unescapeRsc(slice)));

    return parsed ?? [];
  } catch {
    return [];
  }
}

/**
 * Builds the absolute URL for a marker from its (possibly relative) `href`.
 */
function resolveUrl(href: unknown): string {
  if (typeof href === 'string' && href.length > 0) {
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) return SITE_ORIGIN + href;
  }
  return `${SITE_ORIGIN}/`;
}

/**
 * PURE. Normalizes raw Hazlo Hoy markers into `NormalizedSearchResult`s.
 * When `query` is provided, only markers whose title/subtitle contain it
 * (case-insensitive) are kept. Caps the output at 25 results.
 */
export function normalizeMarkers(markers: any[], query?: string): NormalizedSearchResult[] {
  if (!Array.isArray(markers)) return [];

  const needle = query ? query.trim().toLowerCase() : '';

  const filtered = needle
    ? markers.filter((m) => {
        const title = typeof m?.title === 'string' ? m.title.toLowerCase() : '';
        const subtitle = typeof m?.subtitle === 'string' ? m.subtitle.toLowerCase() : '';
        return title.includes(needle) || subtitle.includes(needle);
      })
    : markers;

  return filtered.slice(0, 25).map((m) => {
    const hasLocation = typeof m?.lat === 'number' && typeof m?.lng === 'number';

    const result: NormalizedSearchResult = {
      provider: PROVIDER_NAME,
      provider_id: m?.id,
      type: mapKindToType(m?.kind),
      title: m?.title,
      subtitle: m?.subtitle,
      url: resolveUrl(m?.href),
      metadata: {
        kind: m?.kind,
        source: m?.source,
        approx: m?.approx,
        confidence: m?.confidence,
        color: m?.color,
      },
    };

    if (hasLocation) {
      result.location = [m.lng, m.lat];
    }

    return result;
  });
}
