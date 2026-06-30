import { useState, useEffect } from 'react';
import { GeoRespondeClient } from '@georesponde/client';
import type { Layer } from '@georesponde/client';

// Hardcode relative path because of our vite config serving the public dir
const client = new GeoRespondeClient({ baseUrl: '/catalog' });

export function useCatalog() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Promise.all([
      client.getLayers(),
      client.getDatasets(),
      client.getProviders()
    ]).then(([layersData, datasetsData, providersData]) => {
      setLayers(layersData);
      setDatasets(datasetsData);
      setProviders(providersData);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load catalog:', err);
      setError(err);
      setLoading(false);
    });
  }, []);

  return { layers, datasets, providers, loading, error };
}
