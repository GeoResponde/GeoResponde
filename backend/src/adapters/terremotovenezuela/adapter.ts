import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';

export class TerremotoVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // The API doesn't have a ?q= general search, we use ?name= for federated queries.
      const url = `https://api.terremotovenezuela.com/api/v1/edificios?name=${encodeURIComponent(query)}&limit=50`;
      console.log(`[TerremotoVenezuelaAdapter] Fetching data: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data: any[] = await response.json();
      
      return data.map((building: any) => ({
        provider: this.provider.display_name,
        provider_id: this.provider.id,
        type: 'building',
        title: building.name || building.building_name || 'Unknown Building',
        subtitle: `${building.address || ''}, ${building.city || ''}`.trim().replace(/^,|,$/g, '').trim(),
        status: building.damage_level,
        location: (building.lng != null && building.lat != null) ? [building.lng, building.lat] : undefined,
        url: `https://terremotovenezuela.com/edificio/${building.id || building.linked_building_id || ''}`,
        thumbnail: building.media_urls && building.media_urls.length > 0 ? building.media_urls[0] : building.media_url,
        metadata: {
          construction_type: building.construction_type,
          people_trapped: building.people_trapped,
          has_missing_persons: building.has_missing_persons
        }
      }));
    } catch (error) {
      console.error('[TerremotoVenezuelaAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(pkg: SubmissionPackage): Promise<{ success: boolean; referenceId?: string }> {
    try {
      console.log(`[TerremotoVenezuelaAdapter] Submitting report to API`);
      
      const mapDamageLevel = (level: string) => {
        switch (level) {
          case 'DESTROYED': return 'total';
          case 'SEVERE': return 'severo';
          case 'MODERATE': return 'parcial';
          case 'MINOR': return 'leve';
          default: return 'no_se';
        }
      };

      const payload = {
        building_name: pkg.payload.building_name || 'Unknown',
        address: pkg.payload.address || 'Unknown',
        city: pkg.payload.city || 'Unknown',
        damage_level: mapDamageLevel(pkg.payload.damage_level),
        description: pkg.payload.description || '',
        lat: pkg.payload.lat,
        lng: pkg.payload.lng,
        people_trapped: pkg.payload.people_trapped || 'no_se',
        reporter_name: pkg.payload.reporter_name,
        reporter_contact: pkg.payload.reporter_email || pkg.payload.reporter_phone,
        media_urls: pkg.payload.media_urls || []
      };

      const response = await fetch('https://api.terremotovenezuela.com/api/v1/reportes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`[TerremotoVenezuelaAdapter] Submit failed with status ${response.status}`);
        return { success: false };
      }

      const data = await response.json().catch(() => ({}));

      return { success: true, referenceId: data.id || data.reference_id };
    } catch (error) {
      console.error('[TerremotoVenezuelaAdapter] Submit failed:', error);
      return { success: false };
    }
  }

  async getGeoJSON(): Promise<any> {
    try {
      console.log(`[TerremotoVenezuelaAdapter] Fetching dataset for map layer`);
      
      // Fetch up to 1000 records for the map layer
      const response = await fetch('https://api.terremotovenezuela.com/api/v1/edificios?limit=1000');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data: any[] = await response.json();
      
      const features = data
        .filter(b => b.lng != null && b.lat != null)
        .map(building => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [building.lng, building.lat]
          },
          properties: {
            id: building.id,
            name: building.name || building.building_name || 'Unknown Building',
            category: 'verified_building',
            status: building.damage_level,
            damage_gra: building.damage_level,
            source: `https://terremotovenezuela.com/edificio/${building.id || building.linked_building_id || ''}`,
            provider_id: this.provider.id
          }
        }));

      return {
        type: 'FeatureCollection',
        features
      };
    } catch (error) {
      console.error('[TerremotoVenezuelaAdapter] getGeoJSON failed:', error);
      return { type: 'FeatureCollection', features: [] };
    }
  }
}
