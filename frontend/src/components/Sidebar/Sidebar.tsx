import { useState, type ReactNode, useEffect } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { LayerToggle } from './LayerToggle';
import { useTranslation } from 'react-i18next';

interface Props {
  activeLayerIds: Set<string>;
  onToggleLayer: (id: string) => void;
  activeLayerVariants?: Record<string, string>;
  onToggleLayerVariant?: (layerId: string, variantId: string) => void;
  unavailableLayerIds?: Set<string>;
  /** Shared time-window control, rendered above the layer list. */
  timeWindowSlot?: ReactNode;
  /** Dynamic (non-catalog) sources — EONET + aid sites — with their controls. */
  dynamicSourcesSlot?: ReactNode;
}

export function Sidebar({
  activeLayerIds,
  onToggleLayer,
  activeLayerVariants = {},
  onToggleLayerVariant,
  unavailableLayerIds = new Set(),
  timeWindowSlot,
  dynamicSourcesSlot,
}: Props) {
  const { layers, datasets, loading, error } = useCatalog();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['Infrastructure', 'Humanitarian', 'Logistics', 'Community', 'Official']));
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [liveSourcesOpen, setLiveSourcesOpen] = useState(true);
  const [externalOpen, setExternalOpen] = useState(true);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  const toggleCategory = (category: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // The categories that should be collapsed initially, if they exist
  const expandableCategories = ['Hazards', 'Infrastructure', 'Humanitarian', 'Logistics', 'Community', 'Official'];
  
  // The ones that are scientific and shown by default directly under Situation Layers
  const scientificCategories = ['Scientific'];

  const getDatasetForLayer = (layer: any) => {
    if (!layer.datasetIds || layer.datasetIds.length === 0) return undefined;
    
    if (layer.visualization?.variants?.length > 0) {
      const activeVariantId = activeLayerVariants[layer.id] || layer.visualization.variants[0].id;
      const variantIndex = layer.visualization.variants.findIndex((v: any) => v.id === activeVariantId);
      const targetDatasetId = layer.datasetIds[variantIndex !== -1 ? variantIndex : 0];
      const found = datasets.find(d => d.id === targetDatasetId);
      if (found) return found;
    }
    
    return datasets.find(d => layer.datasetIds.includes(d.id));
  };

  return (
    <>
    <button 
      className="mobile-sidebar-toggle"
      onClick={() => setMobileOpen(!mobileOpen)}
    >
      {mobileOpen ? 'Close Layers' : 'View Layers'}
    </button>
    <div className={`sidebar-container glass-panel animate-fade-in ${mobileOpen ? 'mobile-open' : ''}`}>
      <div 
        className="sidebar-header" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isMobile ? 'pointer' : 'default' }}
        onClick={isMobile ? () => setMobileOpen(!mobileOpen) : undefined}
      >
        <div>
          <h1 className="sidebar-title">{t('sidebar.title')}</h1>
          <p className="sidebar-subtitle">{t('sidebar.subtitle')}</p>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>{t('sidebar.currentEvent')}</p>
        </div>
        <div className="mobile-chevron-indicator">
          {mobileOpen ? '▼' : '▲'}
        </div>
      </div>
      
      <div className="sidebar-content">
        {loading && <p>{t('sidebar.loading')}</p>}
        {error && <p style={{ color: '#ef4444' }}>{t('sidebar.error')}</p>}
        
        {!loading && !error && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', color: '#e2e8f0', marginBottom: '16px', fontSize: '18px' }}>
                {t('sidebar.situationLayers')}
              </div>

              {/* Shared time window — drives EONET, USGS and FUNVISIS */}
              {timeWindowSlot}

              {/* Scientific Layers always expanded without a category header */}
              <div style={{ paddingLeft: '8px', marginBottom: '20px' }}>
                {layers.filter(l => scientificCategories.includes(l.category)).map(layer => (
                  <LayerToggle 
                    key={layer.id} 
                    layer={layer}
                    dataset={getDatasetForLayer(layer)}
                    isActive={activeLayerIds.has(layer.id)} 
                    onToggle={onToggleLayer}
                    activeVariantId={activeLayerVariants[layer.id]}
                    onToggleVariant={onToggleLayerVariant}
                    isUnavailable={unavailableLayerIds.has(layer.id)}
                  />
                ))}
              </div>
              
              {/* Other categories are collapsible */}
              {expandableCategories.map(category => {
                const categoryLayers = layers.filter(l => l.category === category);
                if (categoryLayers.length === 0) return null;
                
                return (
                  <div key={category} style={{ marginBottom: '1rem' }}>
                    <div 
                      onClick={() => toggleCategory(category)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        color: '#e2e8f0'
                      }}
                    >
                      <span>{t(`sidebar.categories.${category}`) || category}</span>
                      <span>{openCategories.has(category) ? '▼' : '▶'}</span>
                    </div>
                    {openCategories.has(category) && (
                      <div style={{ paddingLeft: '8px' }}>
                        {categoryLayers.map(layer => (
                          <LayerToggle 
                            key={layer.id} 
                            layer={layer}
                            dataset={getDatasetForLayer(layer)}
                            isActive={activeLayerIds.has(layer.id)} 
                            onToggle={onToggleLayer}
                            activeVariantId={activeLayerVariants[layer.id]}
                            onToggleVariant={onToggleLayerVariant}
                            isUnavailable={unavailableLayerIds.has(layer.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dynamic (non-catalog) live sources: EONET + aid sites */}
              {dynamicSourcesSlot && (
                <div style={{ marginTop: '20px' }}>
                  <div
                    onClick={isMobile ? () => setLiveSourcesOpen(!liveSourcesOpen) : undefined}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isMobile ? 'pointer' : 'default',
                      fontWeight: 'bold',
                      color: '#e2e8f0',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <span>{t('sidebar.liveSources')}</span>
                    {isMobile && <span>{liveSourcesOpen ? '▼' : '▶'}</span>}
                  </div>
                  {(!isMobile || liveSourcesOpen) && dynamicSourcesSlot}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div
                onClick={isMobile ? () => setExternalOpen(!externalOpen) : undefined}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: isMobile ? 'pointer' : 'default',
                  fontWeight: 'bold',
                  color: '#e2e8f0',
                  marginBottom: '8px',
                }}
              >
                <span>{t('sidebar.externalResources')}</span>
                {isMobile && <span>{externalOpen ? '▼' : '▶'}</span>}
              </div>
              {(!isMobile || externalOpen) && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://drp-venezuela-disastersesriven.hub.arcgis.com/pages/aplicaciones#cu7yb5d6p" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ Esri Venezuela Disaster Hub
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://gis.earthdata.nasa.gov/portal/apps/mapviewer/index.html?webmap=0c3d77dd5aae46e4829d9a282477615c" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ NASA Sentinel Damage Map
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ USGS Earthquake Hazards Program
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://geofon.gfz-potsdam.de/eqexplorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ GEOFON (GFZ Potsdam) Earthquake Explorer
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://pubs.usgs.gov/ds/2006/199/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ USGS Geologic Map of Northern Venezuela (DS 199)
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://emergency.copernicus.eu/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ Copernicus Emergency Management Service
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://www.funvisis.gob.ve/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ FUNVISIS
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://terremotovenezuela.com" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ TerremotoVenezuela
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://github.com/GEMScienceTools/gem-global-active-faults" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ GEM Global Active Faults Database
                  </a>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <a href="https://source.coop/planet/venezuela-earthquake-2026-06-24" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ Planet Post-Event Imagery (Source Cooperative)
                  </a>
                </li>
                <li>
                  <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    ↗ OpenStreetMap Contributors
                  </a>
                </li>
              </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
