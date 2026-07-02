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

function loadKeys(locale) {
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
