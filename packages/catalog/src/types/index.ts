export interface Organization {
  id: string;
  name: string;
  website?: string;
  type: 'NGO' | 'GOV' | 'ACADEMIC' | 'PRIVATE' | 'OTHER';
}

export interface Source {
  id: string;
  name: string;
  url: string;
  organizationId: string;
  license?: string;
}

export interface Dataset {
  id: string;
  title: string;
  description?: string;
  sourceId: string;
  tags?: string[];
}

export interface Layer {
  id: string;
  name: string;
  datasetIds: string[];
  format?: string;
  category: 'Scientific' | 'Infrastructure' | 'Humanitarian' | 'Logistics' | 'Community' | 'Earthquakes' | 'Geology' | 'Satellite' | 'Hazards' | string;
  confidence: 'Verified' | 'Cross-Referenced' | 'Community Report' | 'Pending Verification' | 'Official' | 'Community Verified' | string;
  refreshFrequency?: 'Real-time' | 'Hourly' | 'Daily' | 'Weekly' | 'Static';
  enabled: boolean;
  visualization?: Record<string, any>;
  timestampField?: string;
  timestampFormat?: 'epoch' | 'iso';
}

export interface SearchIndexEntry {
  id: string;
  title: string;
  type: 'organization' | 'source' | 'dataset' | 'layer';
  description?: string;
}

export interface CatalogData {
  organizations: Organization[];
  sources: Source[];
  datasets: Dataset[];
  layers: Layer[];
}
