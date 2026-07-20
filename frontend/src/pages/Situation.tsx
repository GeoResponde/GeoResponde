import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldCheck } from 'lucide-react';
import { bboxToEonetParam } from '@georesponde/shared';
import { useCatalog } from '../hooks/useCatalog';
import { useEonetEvents } from '../hooks/useEonetEvents';
import { useAidSites } from '../hooks/useAidSites';
import { useGeofonEarthquakes } from '../hooks/useGeofonEarthquakes';
import { useUsgsEarthquakes } from '../hooks/useUsgsEarthquakes';
import { useFunvisisEarthquakes } from '../hooks/useFunvisisEarthquakes';
import { useDamageLayer } from '../hooks/useDamageLayer';
import { useNasaDpmLayer } from '../hooks/useNasaDpmLayer';
import { EONET_CATEGORIES } from '../lib/eonet';
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
const GEOFON_LAYER_ID = 'layer-geofon';
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
  const [visibleInterval, setVisibleInterval] = useState<[number, number]>([0, 0]);
  const [country, setCountry] = useState('VE');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(EONET_CATEGORIES),
  );
  const [showSitios, setShowSitios] = useState(false);
  const [activeTipos, setActiveTipos] = useState<Set<string>>(() => new Set(AID_SITE_TIPOS));
  const [activeLayerVariants, setActiveLayerVariants] = useState<Record<string, string>>({});

  // Shared time window: presets drive the actual fetch window (default: 7 days).
  const [preset, setPreset] = useState<TimePreset>(DEFAULT_TIME_PRESET);
  const [advanced, setAdvanced] = useState(false);
  const timeWindow = presetToWindow(preset);

  const bbox = bboxToEonetParam(country);
  const usgsActive = activeLayerIds.has(USGS_LAYER_ID);
  const geofonActive = activeLayerIds.has(GEOFON_LAYER_ID);
  const funvisisActive = activeLayerIds.has(FUNVISIS_LAYER_ID);
  // Copernicus EMS damage layers are served live by the gateway route.
  const damageActive = activeLayerIds.has('layer-copernicus-damage');
  const groundMovementActive = activeLayerIds.has('layer-copernicus-ground-movement');
  // NASA ARIA DPM (damaged structures) served live by the gateway route (NASA-02).
  const nasaDpmActive = activeLayerIds.has('layer-nasa-sentinel-damage');

  const { features: eonetFeatures } = useEonetEvents(
    country,
    [...activeCategories],
    timeWindow.eonetStart,
  );
  const { features: aidSiteFeatures } = useAidSites(showSitios);
  const { collection: usgsData } = useUsgsEarthquakes(usgsActive, bbox, timeWindow.quakeStart);
  const { collection: geofonData } = useGeofonEarthquakes(geofonActive, bbox, timeWindow.quakeStart);
  const { collection: funvisisData } = useFunvisisEarthquakes(funvisisActive, timeWindow.quakeStart);
  const { collection: copernicusDamageData, attribution: copernicusAttribution } = useDamageLayer(
    'grading',
    damageActive,
  );
  const { collection: groundMovementData } = useDamageLayer('ground-movement', groundMovementActive);
  // Current map viewport, tracked (debounced) so the DPM layer requests only the
  // polygons in view (15-04). `[minLng,minLat,maxLng,maxLat]`.
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const {
    collection: nasaDpmData,
    attribution: nasaAttribution,
    disclaimer: nasaDisclaimer,
    loading: nasaDpmLoading,
    source: nasaDpmSource,
  } = useNasaDpmLayer(nasaDpmActive, mapBounds);

  const range = React.useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    if (showEonet && eonetFeatures && eonetFeatures.length > 0) {
      for (const f of eonetFeatures) {
        const t = f.properties.firstDateEpoch;
        if (t && t < min) min = t;
        if (t && t > max) max = t;
      }
    }

    if (usgsActive && usgsData && usgsData.features && usgsData.features.length > 0) {
      for (const f of usgsData.features) {
        const t = f.properties.time;
        if (t && t < min) min = t;
        if (t && t > max) max = t;
      }
    }

    if (geofonActive && geofonData && geofonData.features && geofonData.features.length > 0) {
      for (const f of geofonData.features) {
        const t = f.properties.time;
        if (t && t < min) min = t;
        if (t && t > max) max = t;
      }
    }

    if (funvisisActive && funvisisData && funvisisData.features && funvisisData.features.length > 0) {
      for (const f of funvisisData.features) {
        const t = f.properties.time;
        if (t && t < min) min = t;
        if (t && t > max) max = t;
      }
    }

    if (min === Infinity || max === -Infinity) {
      return { min: null, max: null };
    }
    return { min, max };
  }, [showEonet, eonetFeatures, usgsActive, usgsData, geofonActive, geofonData, funvisisActive, funvisisData]);

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
    if (range.min !== null && range.max !== null) {
      setVisibleInterval([range.min, range.max]);
    }
  }, [range.min, range.max]);

  useEffect(() => {
    // Determine which STATIC layers are missing their datasets. The dynamic
    // earthquake layers (USGS, FUNVISIS) are served by the gateway and are never
    // "unavailable" here.
    const checkAvailability = async () => {
      const newUnavailable = new Set<string>();

      for (const layer of layers) {
        // Gateway-served layers (USGS, FUNVISIS, Copernicus damage +
        // ground-movement) are never "unavailable" via a /data HEAD probe.
        if (
          layer.id === USGS_LAYER_ID ||
          layer.id === GEOFON_LAYER_ID ||
          layer.id === FUNVISIS_LAYER_ID ||
          layer.id === 'layer-copernicus-damage' ||
          layer.id === 'layer-copernicus-ground-movement'
        )
          continue;

        let sourceUrl = '';
        if (layer.id === 'layer-hospitals') sourceUrl = '/data/hospitals.geojson';
        else if (layer.id === 'layer-faults') sourceUrl = '/data/faults.geojson';
        else if (layer.id === 'layer-geologic-units') sourceUrl = '/data/geologic_units.geojson';
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const layer = layers.find((l) => l.id === id);
        if (layer?.visualization?.variants?.length > 0) {
          setActiveLayerVariants((variants) => ({
            ...variants,
            // Preserve if already set, else default to first variant
            [id]: variants[id] || layer.visualization.variants[0].id,
          }));
        }
      }
      return next;
    });
  };

  const toggleLayerVariant = (layerId: string, variantId: string) => {
    setActiveLayerVariants((prev) => ({
      ...prev,
      [layerId]: variantId,
    }));
  };

  const timeWindowSlot = (
    <TimeWindowControl
      preset={preset}
      onPreset={setPreset}
      advanced={advanced}
      onToggleAdvanced={setAdvanced}
      min={range.min}
      max={range.max}
      interval={visibleInterval}
      onRangeChange={setVisibleInterval}
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
        globalTimeFilter={advanced ? visibleInterval : null}
        eonetFeatures={eonetFeatures}
        showEonet={showEonet}
        eonetVisibleInterval={showEonet && advanced ? visibleInterval : null}
        eonetActiveCategories={showEonet ? activeCategories : undefined}
        eonetSelectedId={selectedId}
        onEonetSelect={setSelectedId}
        eonetCountry={showEonet ? country : undefined}
        aidSiteFeatures={aidSiteFeatures}
        showAidSites={showSitios}
        aidSiteActiveTipos={showSitios ? activeTipos : undefined}
        usgsData={usgsData}
        geofonData={geofonData}
        funvisisData={funvisisData}
        copernicusDamageData={copernicusDamageData}
        copernicusGroundMovementData={groundMovementData}
        copernicusAttribution={copernicusAttribution}
        nasaDpmData={nasaDpmData}
        nasaAttribution={nasaAttribution}
        nasaDisclaimer={nasaDisclaimer}
        nasaDpmLoading={nasaDpmLoading}
        nasaDpmWarming={nasaDpmActive && nasaDpmSource === 'warming'}
        onViewportBoundsChange={setMapBounds}
        activeLayerVariants={activeLayerVariants}
      />
      <Sidebar
        activeLayerIds={activeLayerIds}
        onToggleLayer={toggleLayer}
        activeLayerVariants={activeLayerVariants}
        onToggleLayerVariant={toggleLayerVariant}
        unavailableLayerIds={unavailableLayerIds}
        timeWindowSlot={timeWindowSlot}
        dynamicSourcesSlot={dynamicSourcesSlot}
      />
    </div>
  );
}
