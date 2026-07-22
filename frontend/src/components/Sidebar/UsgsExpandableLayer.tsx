import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { Layer } from '@georesponde/client';
import { useTranslation } from 'react-i18next';

interface Props {
  layer: Layer;
  dataset?: any;
  activeLayerIds: Set<string>;
  onToggleLayer: (id: string) => void;
}

export function UsgsExpandableLayer({ layer, dataset, activeLayerIds, onToggleLayer }: Props) {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const currentLang = i18n.language.split('-')[0];
  const getName = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[currentLang] || obj.en || obj.es || Object.values(obj)[0] as string;
  };

  const displayName = getName(layer.name);
  const displayDescription = dataset?.description ? getName(dataset.description) : null;
  
  // The two sub-layers. 'layer-earthquakes' is the base one. We invent 'layer-usgs-shakemap' as a virtual layer ID.
  const isEarthquakesActive = activeLayerIds.has('layer-earthquakes');
  const isShakeMapActive = activeLayerIds.has('layer-usgs-shakemap');
  
  // Top level is active if ANY sub-layer is active
  const isAnyActive = isEarthquakesActive || isShakeMapActive;

  return (
    <div style={{ marginBottom: '8px' }}>
      <div 
        className={`layer-item ${isAnyActive ? 'active' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Activity className="layer-icon" size={20} />
          <div className="layer-info" style={{ width: '100%' }}>
            <div className="layer-name">{displayName}</div>
            {isExpanded && displayDescription && (
              <div className="layer-description" style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                {displayDescription}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '8px' }}>
          {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ 
          marginLeft: '24px', 
          paddingLeft: '12px', 
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {/* Sub-item: Epicenters */}
          <div 
            onClick={(e) => { e.stopPropagation(); onToggleLayer('layer-earthquakes'); }}
            style={{ 
              padding: '8px', 
              borderRadius: '4px',
              backgroundColor: isEarthquakesActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              border: isEarthquakesActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: isEarthquakesActive ? '#38bdf8' : 'transparent',
              border: '1px solid #94a3b8'
            }} />
            <span style={{ color: isEarthquakesActive ? '#e2e8f0' : '#94a3b8', fontSize: '0.875rem' }}>
              Earthquake Epicenters
            </span>
          </div>

          {/* Sub-item: ShakeMap */}
          <div 
            onClick={(e) => { e.stopPropagation(); onToggleLayer('layer-usgs-shakemap'); }}
            style={{ 
              padding: '8px', 
              borderRadius: '4px',
              backgroundColor: isShakeMapActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              border: isShakeMapActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: isShakeMapActive ? '#38bdf8' : 'transparent',
              border: '1px solid #94a3b8'
            }} />
            <span style={{ color: isShakeMapActive ? '#e2e8f0' : '#94a3b8', fontSize: '0.875rem' }}>
              ShakeMap Contours (MMI)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
