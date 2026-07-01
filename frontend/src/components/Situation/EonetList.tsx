import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK, type RenderFeature } from '../../lib/eonet';

interface Props {
  features: RenderFeature[];
  visibleEpoch: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Chronological (oldest→newest) list of EONET events, filtered to the timeline
 * cutoff (`firstDateEpoch <= visibleEpoch`). Each row mirrors the map: a
 * category color dot, title, first-appearance date and source. Clicking a row
 * selects it (and the map focuses it); the selected row is highlighted.
 */
export function EonetList({ features, visibleEpoch, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const visible = features.filter((f) => f.properties.firstDateEpoch <= visibleEpoch);

  if (visible.length === 0) {
    return (
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '16px',
          color: '#94a3b8',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        {t('situation.eonet.emptyList')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>
        {t('situation.eonet.listHeading')} ({visible.length})
      </div>
      {visible.map((f) => {
        const p = f.properties;
        const color = CATEGORY_COLORS[p.category] ?? CATEGORY_COLOR_FALLBACK;
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(selected ? null : p.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              textAlign: 'left',
              width: '100%',
              background: selected ? '#334155' : '#1e293b',
              border: `1px solid ${selected ? color : '#334155'}`,
              borderLeft: `4px solid ${color}`,
              borderRadius: '8px',
              padding: '8px 10px',
              cursor: 'pointer',
              color: '#e2e8f0',
            }}
          >
            <span
              style={{
                flex: '0 0 auto',
                width: '10px',
                height: '10px',
                marginTop: '4px',
                borderRadius: '50%',
                background: color,
              }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.title}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {t(`situation.eonet.categories.${p.category}`)} ·{' '}
                {new Date(p.firstDate).toLocaleDateString()}
              </span>
              {p.source && (
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {t('situation.eonet.source')}: {p.source}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
