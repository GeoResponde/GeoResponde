import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { useEonetEvents } from '../hooks/useEonetEvents';
import { EONET_CATEGORIES } from '../lib/eonet';
import { MapViewer } from '../components/Map/MapViewer';
import { Sidebar } from '../components/Sidebar/Sidebar';

export function Situation() {
  const { t } = useTranslation();
  const { layers } = useCatalog();
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());
  const [unavailableLayerIds, setUnavailableLayerIds] = useState<Set<string>>(new Set());
  const [showEonet, setShowEonet] = useState(true);

  const { features: eonetFeatures } = useEonetEvents('VE', EONET_CATEGORIES as unknown as string[]);

  useEffect(() => {
    // Determine which layers are missing their datasets
    const checkAvailability = async () => {
      const newUnavailable = new Set<string>();
      
      for (const layer of layers) {
        let sourceUrl = '/data/earthquakes.geojson';
        if (layer.id === 'layer-funvisis') sourceUrl = '/data/funvisis-earthquakes.geojson';
        else if (layer.id === 'layer-hospitals') sourceUrl = '/data/hospitals.geojson';
        else if (layer.id === 'layer-faults') sourceUrl = '/data/faults.geojson';
        else if (layer.id === 'layer-geologic-units') sourceUrl = '/data/geologic_units.geojson';
        else if (layer.id === 'layer-copernicus-ground-movement') sourceUrl = '/data/copernicus/groundMovement.geojson';
        else if (layer.id === 'layer-citizen-reports') sourceUrl = '/data/citizen-reports.geojson';
        else if (layer.id === 'layer-nasa-sentinel-damage') sourceUrl = ''; // dynamic
        else if (layer.visualization?.type === 'raster') sourceUrl = layer.visualization.url;
        else if (layer.id === 'layer-earthquakes') sourceUrl = '/data/earthquakes.geojson';
        else sourceUrl = '';
        
        if (sourceUrl && sourceUrl.startsWith('/data/')) {
          try {
            const res = await fetch(sourceUrl, { method: 'HEAD' });
            if (!res.ok) {
              newUnavailable.add(layer.id);
            }
          } catch (e) {
            newUnavailable.add(layer.id);
          }
        }
      }
      setUnavailableLayerIds(newUnavailable);
    };

    if (layers.length > 0) {
      checkAvailability();
    }
  }, [layers]);

  const toggleLayer = (id: string) => {
    setActiveLayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
      <MapViewer
        activeLayerIds={activeLayerIds}
        setUnavailableLayerIds={setUnavailableLayerIds}
        unavailableLayerIds={unavailableLayerIds}
        eonetFeatures={eonetFeatures}
        showEonet={showEonet}
      />
      <label
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#1e293b',
          border: '1px solid #334155',
          color: '#e2e8f0',
          padding: '8px 12px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <input
          type="checkbox"
          checked={showEonet}
          onChange={(e) => setShowEonet(e.target.checked)}
        />
        {t('situation.eonet.layerLabel')}
      </label>
      <Sidebar
        activeLayerIds={activeLayerIds} 
        onToggleLayer={toggleLayer} 
        unavailableLayerIds={unavailableLayerIds}
      />
    </div>
  );
}
