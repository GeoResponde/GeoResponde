#!/usr/bin/env node
// Guards en/es i18n parity: both locales must expose the exact same key set.
// Exits 1 (with a diff) when a key exists in one locale but not the other.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(here, '../frontend/src/i18n/locales');

/** Flatten a nested object into dotted leaf keys. */
function flatten(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flatten(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** (1) Fails loudly if a locale bundle isn't valid UTF-8 (see issue #61 — a prior
 *      reformat silently left the es bundle in Latin-1, corrupting accented
 *      Spanish on load without ever failing this script). 
 * (2) Checks for common Spanish mojibake sequences (see issue #99 - Regression 
 *     introduced while attempting to re-encode the Spanish bundle in PR #91).
 **/
function validateLocaleIntegrity(locale) {
  const file = resolve(localesDir, locale, 'common.json');
  const bytes = readFileSync(file);
  const decoder = new TextDecoder('utf-8', { fatal: true });  
  try {    
    const text = decoder.decode(bytes);
    const mojibakeRegex = /[ÃÂâ][\u0080-\u00BF]/;
    if (mojibakeRegex.test(text)) {
      console.error(`i18n encoding FAILED — ${locale}/common.json contains mojibake characters.`);
      process.exit(1);
    }
  } catch {
    console.error(`i18n encoding FAILED — ${locale}/common.json is not valid UTF-8.`);
    process.exit(1);
  }
}

function loadKeys(locale) {
  validateLocaleIntegrity(locale);
  const file = resolve(localesDir, locale, 'common.json');
  return new Set(flatten(JSON.parse(readFileSync(file, 'utf8'))));
}

const en = loadKeys('en');
const es = loadKeys('es');

const missingInEs = [...en].filter((k) => !es.has(k)).sort();
const missingInEn = [...es].filter((k) => !en.has(k)).sort();

if (missingInEs.length === 0 && missingInEn.length === 0) {
  console.log(`i18n parity OK — ${en.size} keys in both en and es.`);
  process.exit(0);
}

console.error('i18n parity FAILED — en/es key sets differ.');
if (missingInEs.length) console.error('\nMissing in es:\n  ' + missingInEs.join('\n  '));
if (missingInEn.length) console.error('\nMissing in en:\n  ' + missingInEn.join('\n  '));
process.exit(1);
