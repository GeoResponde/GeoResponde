export interface JuntosVeProperties {
  id: string;
  type: string;
  status: string;
  description: string | null;
  photo_url: string | null;
  people_count: number | null;
  capacity: number | null;
  spots_available: number | null;
  accepts: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface JuntosVeFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: JuntosVeProperties;
}
