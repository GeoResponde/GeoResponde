#!/usr/bin/env node
// Scaffolds a new provider adapter under backend/src/adapters/<provider-id>/
// from the skeleton documented in
// docs/providers/provider-integration-template.md (Appendix: minimal
// copy-pasteable skeleton). Usage:
//
//   node scripts/scaffold-provider.js my-provider
//
// Refuses to overwrite an existing provider folder.
const fs = require('fs');
const path = require('path');

function toPascalCase(id) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toDisplayName(id) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function adapterTemplate(providerId, className, displayName) {
  return `import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parse${className}Response, ${className}Item } from './parser.js';

const API_BASE = 'https://your-provider.example/api/records';

/**
 * Adapter for ${displayName} (https://your-provider.example/), a missing
 * persons registry exposing a public JSON endpoint.
 */
export class ${className}Adapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(\`[${className}Adapter] Fetching data for query: "\${query}"\`);

      const url = \`\${API_BASE}?q=\${encodeURIComponent(query)}&limit=20\`;
      const response = await fetchJson<${className}Item[]>(url, { timeoutMs: 10000 });

      const normalizedResults = parse${className}Response(response);

      console.log(
        \`[${className}Adapter] Extracted \${normalizedResults.length} normalized results for query: "\${query}"\`,
      );

      return normalizedResults;
    } catch (error) {
      console.error('[${className}Adapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
`;
}

function parserTemplate(providerId, className, displayName) {
  return `import { NormalizedSearchResult } from '@georesponde/shared';
import { makeStatusMapper, normalizeGender } from '../person.js';

/**
 * Shape of a single record returned by ${displayName}'s public API. Only the
 * fields we consume are typed; the API may return more columns.
 */
export interface ${className}Item {
  id: string;
  full_name?: string | null;
  age?: number | null;
  sex?: string | null;
  status?: string | null;
  last_seen_location?: string | null;
  photo_url?: string | null;
  updated_at?: string | null;
}

const toStatus = makeStatusMapper({
  desaparecido: 'missing',
  encontrado: 'found',
});

export function normalizeRecord(record: ${className}Item): NormalizedSearchResult {
  return {
    provider: '${displayName}',
    provider_id: record.id,
    type: 'person',
    title: record.full_name || 'Desconocido',
    status: record.status ?? undefined,
    last_update: record.updated_at ?? undefined,
    thumbnail: record.photo_url ?? undefined,
    url: \`https://your-provider.example/persona/\${record.id}\`,
    person: {
      fullName: record.full_name ?? undefined,
      age: typeof record.age === 'number' ? record.age : undefined,
      gender: normalizeGender(record.sex),
      status: toStatus(record.status),
      rawStatus: record.status ?? undefined,
      lastSeenLocation: record.last_seen_location ?? undefined,
      photoUrl: record.photo_url ?? undefined,
    },
    metadata: {},
  };
}

/**
 * Pure parser: maps ${displayName}'s array response into normalized search
 * results. Returns an empty array when the input is not an array.
 */
export function parse${className}Response(
  response: ${className}Item[] | undefined | null,
): NormalizedSearchResult[] {
  if (!Array.isArray(response)) {
    return [];
  }

  return response.map(normalizeRecord);
}
`;
}

function testTemplate(providerId, className, displayName) {
  return `import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse${className}Response } from '../parser.js';

describe('${displayName} Parser', () => {
  const fixturePath = path.join(__dirname, '../fixtures/records.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  it('parses the fixture array into normalized results', () => {
    const results = parse${className}Response(fixture);
    expect(results).toHaveLength(2);
  });

  it('maps the first record correctly', () => {
    const [first] = parse${className}Response(fixture);
    expect(first.provider).toBe('${displayName}');
    expect(first.type).toBe('person');
    expect(first.title).toBeTruthy();
  });

  it('returns an empty array when input is not an array', () => {
    expect(parse${className}Response(undefined)).toEqual([]);
    expect(parse${className}Response(null)).toEqual([]);
    expect(parse${className}Response({} as any)).toEqual([]);
  });
});
`;
}

function main() {
  const providerId = process.argv[2];

  if (!providerId) {
    console.error('Usage: node scripts/scaffold-provider.js <provider-id>');
    process.exit(1);
  }

  if (!/^[a-z][a-z0-9-]*$/.test(providerId)) {
    console.error(
      `Invalid provider id "${providerId}". Use lowercase letters, digits and hyphens only, starting with a letter (e.g. "my-provider").`,
    );
    process.exit(1);
  }

  const adaptersDir = path.resolve(__dirname, '../backend/src/adapters');
  const providerDir = path.join(adaptersDir, providerId);

  if (fs.existsSync(providerDir)) {
    console.error(`Refusing to overwrite: ${path.relative(process.cwd(), providerDir)} already exists.`);
    process.exit(1);
  }

  const className = toPascalCase(providerId);
  const displayName = toDisplayName(providerId);

  fs.mkdirSync(path.join(providerDir, '__tests__'), { recursive: true });
  fs.mkdirSync(path.join(providerDir, 'fixtures'), { recursive: true });

  fs.writeFileSync(path.join(providerDir, 'adapter.ts'), adapterTemplate(providerId, className, displayName));
  fs.writeFileSync(path.join(providerDir, 'parser.ts'), parserTemplate(providerId, className, displayName));
  fs.writeFileSync(
    path.join(providerDir, '__tests__', 'parser.test.ts'),
    testTemplate(providerId, className, displayName),
  );

  console.log(`Scaffolded provider "${providerId}" at ${path.relative(process.cwd(), providerDir)}`);
  console.log('Next steps:');
  console.log('  1. Add a synthetic fixture at fixtures/records.json (see provider-integration-template.md section 5).');
  console.log('  2. Fill in adapter.ts / parser.ts with the real endpoint and field mapping.');
  console.log(`  3. Register the adapter in backend/src/adapters/registry.ts as '${className}Adapter'.`);
  console.log('  4. Add a catalog entry in public/catalog/providers.json (and data/catalog/providers/providers.yaml).');
}

main();
