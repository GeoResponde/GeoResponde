export { GeoRespondeClient } from './client';
export type { ClientOptions } from './client';
// We also re-export types so consumers don't need to depend on @georesponde/catalog directly
export type { 
  CatalogData, 
  Organization, 
  Source, 
  Dataset, 
  Layer, 
  SearchIndexEntry
} from '@georesponde/catalog';
export type { HumanitarianProvider } from '@georesponde/shared';
