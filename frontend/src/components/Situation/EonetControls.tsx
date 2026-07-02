import { useTranslation } from 'react-i18next';
import { COUNTRY_BBOX } from '@georesponde/shared';
import { EONET_CATEGORIES, CATEGORY_COLORS } from '../../lib/eonet';

interface Props {
  country: string;
  onCountry: (iso2: string) => void;
  activeCategories: Set<string>;
  onToggleCategory: (id: string) => void;
}

const USGS_URL = 'https://earthquake.usgs.gov/';

/**
 * EONET filters: a registry-backed country select (defaults to Venezuela) and
 * per-category toggles with color swatches. A footnote documents that EONET
 * earthquakes are out of scope (dead 2015–2018) and points to USGS (EON-05).
 */
export function EonetControls({ country, onCountry, activeCategories, onToggleCategory }: Props) {
  const { t } = useTranslation();
  const countries = Object.keys(COUNTRY_BBOX).sort();

  const countryLabel = (iso2: string) => {
    const label = t(`situation.eonet.countries.${iso2}`);
    return label === `situation.eonet.countries.${iso2}` ? iso2 : label;
  };

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>
        {t('situation.eonet.controlsHeading')}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{t('situation.eonet.countryLabel')}</span>
        <select
          value={country}
          onChange={(e) => onCountry(e.target.value)}
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '6px 8px',
            fontSize: '13px',
          }}
        >
          {countries.map((iso2) => (
            <option key={iso2} value={iso2}>
              {countryLabel(iso2)}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{t('situation.eonet.categoriesLabel')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {EONET_CATEGORIES.map((id) => {
            const active = activeCategories.has(id);
            const color = CATEGORY_COLORS[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleCategory(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: active ? '#334155' : '#0f172a',
                  border: `1px solid ${active ? color : '#334155'}`,
                  borderRadius: '999px',
                  padding: '4px 10px',
                  color: active ? '#e2e8f0' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: active ? 1 : 0.7,
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: color,
                  }}
                />
                {t(`situation.eonet.categories.${id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #334155',
          paddingTop: '8px',
          color: '#64748b',
          fontSize: '11px',
          lineHeight: 1.4,
        }}
      >
        {t('situation.eonet.earthquakesOut')}{' '}
        <a
          href={USGS_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#38bdf8', textDecoration: 'none' }}
        >
          {t('situation.eonet.usgsLink')} ↗
        </a>
      </div>
    </div>
  );
}
