import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { expect } from 'vitest';
import { NormalizedSearchResult } from '@georesponde/shared';

// ESM has no __dirname; derive it from the module URL, same pattern used by
// `packages/catalog/src/index.ts`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read and JSON-parse a fixture file from a provider's `fixtures/` directory.
 *
 * `providerId` is the folder name under `backend/src/adapters/` (e.g.
 * `example-reference`), and `fixtureName` is the file name inside its
 * `fixtures/` directory (e.g. `users.json`). Fixture files must be synthetic
 * data only (see `docs/providers/provider-integration-template.md`, section 5).
 */
export function loadFixture<T = unknown>(providerId: string, fixtureName: string): T {
  const fixturePath = path.join(__dirname, '..', providerId, 'fixtures', fixtureName);
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as T;
}

/**
 * Vitest assertion helper: fails the current test unless `result` conforms to
 * the shape of a {@link NormalizedSearchResult} — every required field is
 * present and has the expected type. Intended as the first assertion in a
 * parser test, before asserting on provider-specific field values.
 */
export function expectNormalizedResult(result: NormalizedSearchResult): void {
  expect(typeof result.provider).toBe('string');
  expect(result.provider.length).toBeGreaterThan(0);

  expect(typeof result.provider_id).toBe('string');
  expect(result.provider_id.length).toBeGreaterThan(0);

  expect(typeof result.type).toBe('string');
  expect(result.type.length).toBeGreaterThan(0);

  expect(typeof result.title).toBe('string');
  expect(result.title.length).toBeGreaterThan(0);

  expect(typeof result.url).toBe('string');
  expect(result.url.length).toBeGreaterThan(0);

  // Optional fields, when present, must have the correct type.
  if (result.subtitle !== undefined) expect(typeof result.subtitle).toBe('string');
  if (result.status !== undefined) expect(typeof result.status).toBe('string');
  if (result.last_update !== undefined) expect(typeof result.last_update).toBe('string');
  if (result.confidence !== undefined) expect(typeof result.confidence).toBe('number');
  if (result.thumbnail !== undefined) expect(typeof result.thumbnail).toBe('string');
  if (result.location !== undefined) {
    expect(Array.isArray(result.location)).toBe(true);
    expect(result.location).toHaveLength(2);
    expect(result.location!.every((n) => typeof n === 'number')).toBe(true);
  }
  if (result.person !== undefined) {
    expect(typeof result.person).toBe('object');
    expect(result.person).not.toBeNull();
  }
  if (result.sources !== undefined) {
    expect(Array.isArray(result.sources)).toBe(true);
  }
  if (result.metadata !== undefined) {
    expect(typeof result.metadata).toBe('object');
    expect(result.metadata).not.toBeNull();
  }
}
