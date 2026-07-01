import { describe, it, expect } from 'vitest';
import {
  normalizeGender,
  normalizeCedula,
  isCedula,
  makeStatusMapper,
} from '../person.js';

describe('person helpers', () => {
  it('normalizes gender labels across languages and codes', () => {
    expect(normalizeGender('masculino')).toBe('male');
    expect(normalizeGender('M')).toBe('male');
    expect(normalizeGender('femenino')).toBe('female');
    expect(normalizeGender('F')).toBe('female');
    expect(normalizeGender('otro')).toBe('other');
    expect(normalizeGender('')).toBeUndefined();
    expect(normalizeGender(null)).toBeUndefined();
    expect(normalizeGender('zzz')).toBe('unknown');
  });

  it('reduces a cédula to its digits', () => {
    expect(normalizeCedula('V-12.345.678')).toBe('12345678');
    expect(normalizeCedula('28••••11')).toBe('2811');
    expect(normalizeCedula(12345678)).toBe('12345678');
    expect(normalizeCedula(null)).toBe('');
  });

  it('recognizes cédula-shaped queries and rejects names', () => {
    expect(isCedula('12345678')).toBe(true);
    expect(isCedula('V-12.345.678')).toBe(true);
    expect(isCedula('12345')).toBe(true);
    expect(isCedula('Maria Perez')).toBe(false);
    expect(isCedula('1234')).toBe(false); // too short
    expect(isCedula('1234567890')).toBe(false); // too long
    expect(isCedula('')).toBe(false);
  });

  it('maps provider status vocabularies to the canonical enum', () => {
    const toStatus = makeStatusMapper({ desaparecido: 'missing', encontrado: 'found' });
    expect(toStatus('desaparecido')).toBe('missing');
    expect(toStatus('ENCONTRADO')).toBe('found');
    expect(toStatus('otra cosa')).toBe('unknown');
    expect(toStatus(undefined)).toBe('unknown');
  });
});
