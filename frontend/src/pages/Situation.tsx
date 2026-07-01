import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { useEonetEvents } from '../hooks/useEonetEvents';
import { EONET_CATEGORIES, appearanceRange } from '../lib/eonet';
import { MapViewer } from '../components/Map/MapViewer';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { EonetTimeline } from '../components/Situation/EonetTimeline';
import { EonetList } from '../components/Situation/EonetList';
import { EonetControls } from '../components/Situation/EonetControls';
import { EonetLegend } from '../components/Situation/EonetLegend';

export function Situation() {
  const { t } = useTranslation();
  const { layers } = useCatalog();
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());
  const [unavailableLayerIds, setUnavailableLayerIds] = useState<Set<string>>(new Set());
  const [showEonet, setShowEonet] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleEpoch, setVisibleEpoch] = useState<number>(0);
  const [country, setCountry] = useState('VE');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(EONET_CATEGORIES),
  );

  const { features: eonetFeatures } = useEonetEvents(country, [...activeCategories]);
  const range = appearanceRange(eonetFeatures);

  const toggleCategory = (id: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // When a new dataset loads (country/category refetch), reset the timeline
  // cutoff to the latest first-appearance so all events show initially.
  useEffect(() => {
    if (range.max !== null) setVisibleEpoch(range.max);
  }, [range.max]);

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
        eonetVisibleEpoch={showEonet ? visibleEpoch : null}
        eonetActiveCategories={showEonet ? activeCategories : undefined}
        eonetSelectedId={selectedId}
        onEonetSelect={setSelectedId}
        eonetCountry={showEonet ? country : undefined}
      />
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          bottom: '24px',
          zIndex: 10,
          width: '340px',
          maxWidth: 'calc(100% - 48px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '0 2px',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            {t('situation.eonet.panelTitle')}
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {t('situation.eonet.panelSource')}
          </span>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            padding: '10px 12px',
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
        {showEonet && (
          <>
            <EonetControls
              country={country}
              onCountry={setCountry}
              activeCategories={activeCategories}
              onToggleCategory={toggleCategory}
            />
            <EonetLegend activeCategories={activeCategories} />
            <EonetTimeline
              min={range.min}
              max={range.max}
              value={visibleEpoch}
              onChange={setVisibleEpoch}
            />
            <EonetList
              features={eonetFeatures}
              visibleEpoch={visibleEpoch}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </>
        )}
      </div>
      <Sidebar
        activeLayerIds={activeLayerIds} 
        onToggleLayer={toggleLayer} 
        unavailableLayerIds={unavailableLayerIds}
      />
    </div>
  );
}
