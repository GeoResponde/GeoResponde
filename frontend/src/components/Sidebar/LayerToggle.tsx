import { useState, useEffect } from 'react';
import { Layers, Activity, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { Layer } from '@georesponde/client';
import { useTranslation } from 'react-i18next';

interface Props {
  layer: Layer;
  dataset?: any;
  isActive: boolean;
  onToggle: (id: string) => void;
  activeVariantId?: string;
  onToggleVariant?: (layerId: string, variantId: string) => void;
  isUnavailable?: boolean;
}

export function LayerToggle({ layer, dataset, isActive, onToggle, activeVariantId, onToggleVariant, isUnavailable = false }: Props) {
  const { i18n, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check initially
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Determine icon based on category
  let Icon = Layers;
  if (layer.category === 'Earthquakes' || layer.category === 'Geology' || layer.category === 'Satellite') Icon = Activity;
  else if (layer.category === 'Humanitarian' || layer.category === 'Community') Icon = ShieldCheck;
  else if (layer.category === 'Infrastructure' || layer.category === 'Hazards') Icon = AlertTriangle;

  const currentLang = i18n.language.split('-')[0]; // e.g., 'es' from 'es-ES'

  const getName = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[currentLang] || obj.en || obj.es || Object.values(obj)[0] as string;
  };

  const displayName = getName(layer.name);
  const displayDescription = dataset?.description ? getName(dataset.description) : null;
  const shouldShowDetails = !isMobile || isExpanded;

  return (
    <div 
      className={`layer-item ${isActive ? 'active' : ''}`}
      onClick={() => onToggle(layer.id)}
    >
      <Icon className="layer-icon" size={20} />
      <div className="layer-info" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="layer-name">{displayName}</div>
          {isMobile && (
            <div 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              style={{ padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
            </div>
          )}
        </div>
        
        {shouldShowDetails && (
          <div style={{ marginTop: '4px' }}>
            {displayDescription && (
              <div className="layer-description" style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', lineHeight: '1.3' }}>
                {displayDescription}
              </div>
            )}
            <div className="layer-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="layer-badge">{t(`sidebar.confidence.${layer.confidence}`) || layer.confidence}</span>
              {isUnavailable && <span className="layer-badge" style={{ backgroundColor: '#ef4444', color: 'white' }}>Unavailable</span>}
            </div>
            {isActive && layer.visualization?.variants?.length > 0 && (
              <div 
                style={{ 
                  marginTop: '12px', 
                  display: 'flex', 
                  backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                  borderRadius: '6px', 
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {layer.visualization.variants.map((v: any) => {
                  const isVariantActive = activeVariantId === v.id || (!activeVariantId && layer.visualization?.variants?.[0].id === v.id);
                  return (
                    <button
                      key={v.id}
                      onClick={() => onToggleVariant?.(layer.id, v.id)}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isVariantActive ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: isVariantActive ? '#38bdf8' : '#94a3b8',
                        fontWeight: isVariantActive ? 'bold' : 'normal',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {v.label || v.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
