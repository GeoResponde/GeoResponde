import { useTranslation } from 'react-i18next';
import { AID_SITE_TIPOS, TIPO_COLORS } from '../../lib/sitios';

interface Props {
  activeTipos: Set<string>;
  onToggleTipo: (tipo: string) => void;
}

/**
 * Aid-site filters: per-type toggle chips with color swatches, matching the
 * EONET category chips. Shown in the Sidebar under the "Aid sites" toggle when
 * the layer is active.
 */
export function AidSitesControls({ activeTipos, onToggleTipo }: Props) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
        {t('situation.sitios.tiposLabel')}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {AID_SITE_TIPOS.map((id) => {
          const active = activeTipos.has(id);
          const color = TIPO_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleTipo(id)}
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
              {t(`situation.sitios.tipos.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
