import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { Report } from '@georesponde/shared';
import { buildUshahidiPost } from '../mapper.js';

const load = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8'));

describe('buildUshahidiPost', () => {
  const request = load('submission.request.json') as Report;
  const expected = load('submission.expected.json');

  it('maps a synthetic missing-person Report to the confirmed v5 post body', () => {
    const result = buildUshahidiPost(request, 12);
    expect(result).toEqual(expected);
  });

  it('drops the sensitive cédula from the entire body', () => {
    const result = buildUshahidiPost(request, 12);
    expect(JSON.stringify(result)).not.toContain('00000123');
    expect(result.values).not.toHaveProperty('cedula');
    expect(result.title).not.toContain('00000123');
    expect(result.content).not.toContain('00000123');
  });

  it('drops the sensitive reporterContact from the entire body', () => {
    const result = buildUshahidiPost(request, 12);
    expect(JSON.stringify(result)).not.toContain('tel:+000');
    expect(result.values).not.toHaveProperty('reporterContact');
    expect(result.content).not.toContain('Contact');
  });

  it('array-wraps every value and maps coords to [{ value: { lat, lon } }]', () => {
    const result = buildUshahidiPost(request, 12);
    for (const v of Object.values(result.values)) {
      expect(Array.isArray(v)).toBe(true);
    }
    expect(result.values.lastSeenCoords).toEqual([{ value: { lat: 10.5, lon: -66.9 } }]);
  });

  it('carries the passed form id and is deterministic for a fixed input', () => {
    const a = buildUshahidiPost(request, 'abc');
    const b = buildUshahidiPost(request, 'abc');
    expect(a.form.id).toBe('abc');
    expect(a).toEqual(b);
  });
});
