import { useTranslation } from 'react-i18next';
import { EONET_CATEGORIES, CATEGORY_COLORS } from '../../lib/eonet';
import { AID_SITE_TIPOS, TIPO_COLORS } from '../../lib/sitios';

interface CopernicusLegendProps {
  activeLayerIds: Set<string>;
  /** EONET events layer state (a dynamic, non-catalog source). */
  showEonet?: boolean;
  eonetActiveCategories?: Set<string>;
  /** Aid-sites layer state (a dynamic, non-catalog source). */
  showAidSites?: boolean;
  aidSiteActiveTipos?: Set<string>;
  /** EU/Copernicus attribution from the gateway `X-Attribution` header (D-07). */
  attribution?: string | null;
  /** ARIA/NASA/ESA/Overture attribution for the DPM layer (ND-06). */
  nasaAttribution?: string | null;
  /** "Experimental — not validated" disclaimer for the DPM layer (ND-06). */
  nasaDisclaimer?: string | null;
}

export function CopernicusLegend({
  activeLayerIds,
  showEonet = false,
  eonetActiveCategories,
  showAidSites = false,
  aidSiteActiveTipos,
  attribution = null,
  nasaAttribution = null,
  nasaDisclaimer = null,
}: CopernicusLegendProps) {
  const { t } = useTranslation();
  const hasDamage = activeLayerIds.has('layer-copernicus-damage');
  const hasBuildings = hasDamage;
  const hasRoads = hasDamage;
  const hasGroundMovement = activeLayerIds.has('layer-copernicus-ground-movement');
  const hasNasa = activeLayerIds.has('layer-nasa-sentinel-damage');
  const hasFaults = activeLayerIds.has('layer-faults');
  const hasCitizenReports = activeLayerIds.has('layer-citizen-reports');

  const eonetCats = EONET_CATEGORIES.filter(
    (id) => !eonetActiveCategories || eonetActiveCategories.has(id),
  );
  const sitioTipos = AID_SITE_TIPOS.filter(
    (id) => !aidSiteActiveTipos || aidSiteActiveTipos.has(id),
  );
  const hasEonet = showEonet && eonetCats.length > 0;
  const hasSitios = showAidSites && sitioTipos.length > 0;

  if (
    !hasBuildings &&
    !hasRoads &&
    !hasGroundMovement &&
    !hasNasa &&
    !hasFaults &&
    !hasCitizenReports &&
    !hasEonet &&
    !hasSitios
  ) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      right: '10px',
      backgroundColor: 'white',
      color: 'black',
      padding: '10px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      zIndex: 10,
      fontSize: '12px',
      fontFamily: 'sans-serif',
      maxHeight: '300px',
      overflowY: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>{t('situation.legend.title')}</div>

      {hasNasa && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.nasaTitle')}</div>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>{t('situation.legend.nasaSubtitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: t('situation.legend.nasaHigh'), color: '#e60000' },
              { label: t('situation.legend.nasaMedium'), color: '#ff5500' },
              { label: t('situation.legend.nasaLow'), color: '#ffff73' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: item.color, border: '1px solid #666' }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasGroundMovement && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.groundMovementTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: 'Above 0.5', color: '#a50026' },
              { label: '0.2 to 0.5', color: '#c82227' },
              { label: '0.1 to 0.2', color: '#ee603d' },
              { label: '0.05 to 0.1', color: '#fca65d' },
              { label: '0 to 0.05', color: '#fede8e' },
              { label: '-0.05 to 0', color: '#def2f7' },
              { label: '-0.1 to -0.05', color: '#a4d3e6' },
              { label: '-0.2 to -0.1', color: '#6aa1cb' },
              { label: '-0.5 to -0.2', color: '#4062ab' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: item.color, border: '1px solid #666' }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasBuildings && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.builtUpTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: t('situation.legend.destroyed'), color: '#c0392b' },
              { label: t('situation.legend.damaged'), color: '#d35400' },
              { label: t('situation.legend.possiblyDamaged'), color: '#f39c12' },
              { label: t('situation.legend.noVisibleDamage'), color: '#27ae60' },
              { label: t('situation.legend.notAnalysed'), color: '#7f8c8d' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: item.color, border: '1px solid #666' }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRoads && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.transportTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#ffbebe', borderTop: '1px solid #686868', borderBottom: '1px solid #686868' }}></div>
              <span>{t('situation.legend.highway')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', backgroundColor: '#ffffff', borderTop: '1px solid #686868', borderBottom: '1px solid #686868' }}></div>
              <span>{t('situation.legend.mainRoad')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '1px', backgroundColor: '#b2b2b2', borderTop: '1px solid #686868', borderBottom: '1px solid #686868' }}></div>
              <span>{t('situation.legend.localRoad')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '1px', borderTop: '2px dashed #b2b2b2', marginTop: '2px' }}></div>
              <span>{t('situation.legend.track')}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>{t('situation.legend.damageNote')}</div>
          </div>
        </div>
      )}

      {hasFaults && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.faultsTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '3px', backgroundColor: '#e74c3c' }}></div>
              <span>{t('situation.legend.plateBoundary')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', backgroundColor: '#f1c40f' }}></div>
              <span>{t('situation.legend.activeFault')}</span>
            </div>
          </div>
        </div>
      )}

      {hasCitizenReports && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('situation.legend.citizenTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: t('situation.legend.missingPerson'), color: '#e74c3c' },
              { label: t('situation.legend.foundPerson'), color: '#2ecc71' },
              { label: t('situation.legend.shelter'), color: '#3498db' },
              { label: t('situation.legend.hospital'), color: '#1abc9c' },
              { label: t('situation.legend.veterinary'), color: '#f39c12' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', backgroundColor: item.color, borderRadius: '50%', border: '1px solid #fff' }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasEonet && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {t('situation.eonet.legendHeading')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {eonetCats.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', backgroundColor: CATEGORY_COLORS[id], borderRadius: '50%', border: '1px solid #fff' }}></div>
                <span>{t(`situation.eonet.categories.${id}`)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSitios && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {t('situation.sitios.legendHeading')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sitioTipos.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', backgroundColor: TIPO_COLORS[id], borderRadius: '50%', border: '1px solid #fff' }}></div>
                <span>{t(`situation.sitios.tipos.${id}`)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasDamage || hasGroundMovement) && attribution && (
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
          {attribution}
        </div>
      )}

      {hasNasa && (nasaAttribution || nasaDisclaimer) && (
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
          {nasaDisclaimer && (
            <div style={{ fontStyle: 'italic', fontWeight: 600, color: '#b45309', marginBottom: nasaAttribution ? '3px' : 0 }}>
              {nasaDisclaimer}
            </div>
          )}
          {nasaAttribution && <div>{nasaAttribution}</div>}
        </div>
      )}
    </div>
  );
}
