export type LayerCategory = 'Scientific' | 'Infrastructure' | 'Humanitarian' | 'Logistics' | 'Community' | 'Earthquakes' | 'Geology' | 'Satellite' | 'Hazards';

export interface HumanitarianProvider {
  id: string;
  display_name: string;
  website: string;
  description: string;
  logo: string;
  status: 'active' | 'inactive' | 'degraded';
  adapter: string;
  capabilities: string[];
}

export interface NormalizedSearchResult {
  provider: string;
  provider_id: string;
  type: string; // 'person', 'building', 'shelter', etc.
  title: string;
  subtitle?: string;
  status?: string;
  location?: [number, number]; // [lng, lat]
  last_update?: string;
  confidence?: number;
  url: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface SubmissionPackage {
  providerId?: string;
  type: string;
  payload: Record<string, any>;
  timestamp: string;
}
