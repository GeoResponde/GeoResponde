import path from 'path';
import { fileURLToPath } from 'url';
import { loadOrganizations, loadSources, loadDatasets, loadLayers, loadProviders } from './loaders/index.js';

// ESM has no __dirname; derive it from the module URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { validateSchemas } from './validators/schema.js';
import { validateRelations } from './validators/relations.js';
import { buildSearchIndex } from './indexers/search.js';
import { writeJson } from './utils/fs.js';

export * from './types/index.js';

export async function validateCatalog() {
  console.log('Loading catalog data...');
  const organizations = await loadOrganizations();
  const sources = await loadSources();
  const datasets = await loadDatasets();
  const layers = await loadLayers();
  const providers = await loadProviders();

  console.log('Validating against JSON Schemas...');
  await validateSchemas(organizations, 'organizations');
  await validateSchemas(sources, 'sources');
  await validateSchemas(datasets, 'datasets');
  await validateSchemas(layers, 'layers');

  console.log('Validating relations (broken references, duplicate IDs)...');
  const catalog = { organizations, sources, datasets, layers, providers };
  validateRelations(catalog as any);

  console.log('Catalog validation passed successfully.');
  return catalog;
}

export async function buildCatalog() {
  const catalog = await validateCatalog();

  console.log('Building search index...');
  const searchIndex = buildSearchIndex(catalog);

  console.log('Writing public catalog artifacts...');
  const publicCatalogDir = path.resolve(__dirname, '../../../public/catalog');

  await writeJson(path.join(publicCatalogDir, 'catalog.json'), catalog);
  await writeJson(path.join(publicCatalogDir, 'organizations.json'), catalog.organizations);
  await writeJson(path.join(publicCatalogDir, 'sources.json'), catalog.sources);
  await writeJson(path.join(publicCatalogDir, 'datasets.json'), catalog.datasets);
  await writeJson(path.join(publicCatalogDir, 'layers.json'), catalog.layers);
  await writeJson(path.join(publicCatalogDir, 'providers.json'), catalog.providers);
  await writeJson(path.join(publicCatalogDir, 'search-index.json'), searchIndex);

  console.log('Build complete.');
}
