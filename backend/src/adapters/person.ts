import { Gender, PersonStatus } from '@georesponde/shared';

/**
 * Normalize a gender/sex label from any provider onto the canonical Gender.
 * Accepts Spanish and English words as well as single-letter codes.
 */
export function normalizeGender(value: unknown): Gender | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (['m', 'masculino', 'male', 'hombre', 'h'].includes(v)) return 'male';
  if (['f', 'femenino', 'female', 'mujer'].includes(v)) return 'female';
  if (['o', 'otro', 'other', 'x'].includes(v)) return 'other';
  return 'unknown';
}

/**
 * Strip a cédula down to its digits for comparison. Masked values (e.g.
 * "28••••11") collapse to the visible digits only.
 */
export function normalizeCedula(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\D+/g, '');
}

/**
 * Heuristic: does this query look like a Venezuelan cédula? Accepts forms like
 * "V-12345678", "12.345.678" or "12345678" (5–9 digits once normalized).
 */
export function isCedula(query: string): boolean {
  const digits = normalizeCedula(query);
  return /^\d{5,9}$/.test(digits) && /^[\d.\s-]*[vVeE]?[\d.\s-]+$/.test(query.trim());
}

/**
 * Build a status normalizer from a provider-specific vocabulary map. Unknown
 * labels fall back to 'unknown'. Matching is case-insensitive.
 */
export function makeStatusMapper(
  map: Record<string, PersonStatus>,
): (value: unknown) => PersonStatus {
  const lower: Record<string, PersonStatus> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return (value: unknown) => {
    if (typeof value !== 'string') return 'unknown';
    return lower[value.trim().toLowerCase()] ?? 'unknown';
  };
}
