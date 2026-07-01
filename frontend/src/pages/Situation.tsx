import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldCheck } from 'lucide-react';
import { bboxToEonetParam } from '@georesponde/shared';
import { useCatalog } from '../hooks/useCatalog';
import { useEonetEvents } from '../hooks/useEonetEvents';
import { useAidSites } from '../hooks/useAidSites';
import { useUsgsEarthquakes } from '../hooks/useUsgsEarthquakes';
import { useFunvisisEarthquakes } from '../hooks/useFunvisisEarthquakes';
import { EONET_CATEGORIES, appearanceRange } from '../lib/eonet';
import { AID_SITE_TIPOS } from '../lib/sitios';
import { presetToWindow, DEFAULT_TIME_PRESET, type TimePreset } from '../lib/timeWindow';
import { MapViewer } from '../components/Map/MapViewer';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { DynamicLayerToggle } from '../components/Sidebar/DynamicLayerToggle';
import { TimeWindowControl } from '../components/Situation/TimeWindowControl';
import { EonetControls } from '../components/Situation/EonetControls';
import { AidSitesControls } from '../components/Situation/AidSitesControls';

/** Dynamic earthquake layers fed by the gateway, not by static /data files. */
const USGS_LAYER_ID = 'layer-earthquakes';
const FUNVISIS_LAYER_ID = 'layer-funvisis';

export function Situation() {
  const { t } = useTranslation();
  const { layers } = useCatalog();
  // USGS live quakes are the priority earthquake layer — ON by default.
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(
    () => new Set([USGS_LAYER_ID]),
  );
  const [unavailableLayerIds, setUnavailableLayerIds] = useState<Set<string>>(new Set());
  // EONET is complementary — opt-in.
  const [showEonet, setShowEonet] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleEpoch, setVisibleEpoch] = useState<number>(0);
  const [country, setCountry] = useState('VE');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(EONET_CATEGORIES),
  );
  const [showSitios, setShowSitios] = useState(false);
  const [activeTipos, setActiveTipos] = useState<Set<string>>(() => new Set(AID_SITE_TIPOS));

  // Shared time window: presets drive the actual fetch window (default: 7 days).
  const [preset, setPreset] = useState<TimePreset>(DEFAULT_TIME_PRESET);
  const [advanced, setAdvanced] = useState(false);
  const timeWindow = presetToWindow(preset);

  const bbox = bboxToEonetParam(country);
  const usgsActive = activeLayerIds.has(USGS_LAYER_ID);
  const funvisisActive = activeLayerIds.has(FUNVISIS_LAYER_ID);

  const { features: eonetFeatures } = useEonetEvents(
    country,
    [...activeCategories],
    timeWindow.eonetStart,
  );
  const { features: aidSiteFeatures } = useAidSites(showSitios);
  const { collection: usgsData } = useUsgsEarthquakes(usgsActive, bbox, timeWindow.quakeStart);
  const { collection: funvisisData } = useFunvisisEarthquakes(funvisisActive, timeWindow.quakeStart);
  const range = appearanceRange(eonetFeatures);

  const toggleCategory = (id: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTipo = (id: string) => {
    setActiveTipos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // When a new dataset loads (country/category/window refetch), reset the
  // scrubber cutoff to the latest first-appearance so all events show initially.
  useEffect(() => {
    if (range.max !== null) setVisibleEpoch(range.max);
  }, [range.max]);

  useEffect(() => {
    // Determine which STATIC layers are missing their datasets. The dynamic
    // earthquake layers (USGS, FUNVISIS) are served by the gateway and are never
    // "unavailable" here.
    const checkAvailability = async () => {
      const newUnavailable = new Set<string>();

      for (const layer of layers) {
        if (layer.id === USGS_LAYER_ID || layer.id === FUNVISIS_LAYER_ID) continue;

        let sourceUrl = '';
        if (layer.id === 'layer-hospitals') sourceUrl = '/data/hospitals.geojson';
        else if (layer.id === 'layer-faults') sourceUrl = '/data/faults.geojson';
        else if (layer.id === 'layer-geologic-units') sourceUrl = '/data/geologic_units.geojson';
        else if (layer.id === 'layer-copernicus-ground-movement') sourceUrl = '/data/copernicus/groundMovement.geojson';
        else if (layer.id === 'layer-citizen-reports') sourceUrl = '/data/citizen-reports.geojson';

        if (sourceUrl && sourceUrl.startsWith('/data/')) {
          try {
            const res = await fetch(sourceUrl, { method: 'HEAD' });
            if (!res.ok) newUnavailable.add(layer.id);
          } catch (e) {
            newUnavailable.add(layer.id);
          }
        }
      }
      setUnavailableLayerIds(newUnavailable);
    };

    if (layers.length > 0) checkAvailability();
  }, [layers]);

  const toggleLayer = (id: string) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const timeWindowSlot = (
    <TimeWindowControl
      preset={preset}
      onPreset={setPreset}
      advanced={advanced}
      onToggleAdvanced={setAdvanced}
      min={range.min}
      max={range.max}
      value={visibleEpoch}
      onScrub={setVisibleEpoch}
    />
  );

  const dynamicSourcesSlot = (
    <>
      <DynamicLayerToggle
        icon={Activity}
        label={t('situation.eonet.layerLabel')}
        description={t('situation.eonet.panelTitle')}
        badge={t('situation.eonet.panelSource')}
        active={showEonet}
        onToggle={() => setShowEonet((v) => !v)}
      >
        <EonetControls
          country={country}
          onCountry={setCountry}
          activeCategories={activeCategories}
          onToggleCategory={toggleCategory}
        />
      </DynamicLayerToggle>

      <DynamicLayerToggle
        icon={ShieldCheck}
        label={t('situation.sitios.layerLabel')}
        badge={t('situation.sitios.badge')}
        active={showSitios}
        onToggle={() => setShowSitios((v) => !v)}
      >
        <AidSitesControls activeTipos={activeTipos} onToggleTipo={toggleTipo} />
      </DynamicLayerToggle>
    </>
  );

  return (
    <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
      <MapViewer
        activeLayerIds={activeLayerIds}
        unavailableLayerIds={unavailableLayerIds}
        eonetFeatures={eonetFeatures}
        showEonet={showEonet}
        eonetVisibleEpoch={showEonet && advanced ? visibleEpoch : null}
        eonetActiveCategories={showEonet ? activeCategories : undefined}
        eonetSelectedId={selectedId}
        onEonetSelect={setSelectedId}
        eonetCountry={showEonet ? country : undefined}
        aidSiteFeatures={aidSiteFeatures}
        showAidSites={showSitios}
        aidSiteActiveTipos={showSitios ? activeTipos : undefined}
        usgsData={usgsData}
        funvisisData={funvisisData}
      />
      <Sidebar
        activeLayerIds={activeLayerIds}
        onToggleLayer={toggleLayer}
        unavailableLayerIds={unavailableLayerIds}
        timeWindowSlot={timeWindowSlot}
        dynamicSourcesSlot={dynamicSourcesSlot}
      />
    </div>
  );
}
