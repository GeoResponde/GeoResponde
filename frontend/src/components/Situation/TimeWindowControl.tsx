import { useTranslation } from 'react-i18next';
import { TIME_PRESETS, type TimePreset } from '../../lib/timeWindow';

interface Props {
  preset: TimePreset;
  onPreset: (preset: TimePreset) => void;
  /** "Datos avanzados" reveals the fine scrubber for power users. */
  advanced: boolean;
  onToggleAdvanced: (next: boolean) => void;
  /** Scrubber bounds/value — only used while `advanced` is on. */
  min: number | null;
  max: number | null;
  value: number;
  onScrub: (epoch: number) => void;
}

/**
 * Shared time-window control for the Situation map. Presets (Hoy / 7 días /
 * 1 mes / Histórico) drive the actual fetch window for EONET, USGS and FUNVISIS
 * so the map defaults to recent activity. "Datos avanzados" reveals the fine
 * order-of-appearance scrubber (EONET) for power users.
 */
export function TimeWindowControl({
  preset,
  onPreset,
  advanced,
  onToggleAdvanced,
  min,
  max,
  value,
  onScrub,
}: Props) {
  const { t } = useTranslation();
  const disabled = min === null || max === null || min === max;

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '12px 14px',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>
        {t('situation.timeline.heading')}
      </span>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {TIME_PRESETS.map((p) => {
          const active = p === preset;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => onPreset(p)}
              style={{
                flex: '1 1 auto',
                background: active ? '#3b82f6' : '#0f172a',
                border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
                borderRadius: '8px',
                padding: '6px 8px',
                color: active ? '#f8fafc' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t(`situation.timeline.presets.${p}`)}
            </button>
          );
        })}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#94a3b8',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={advanced}
          onChange={(e) => onToggleAdvanced(e.target.checked)}
        />
        {t('situation.timeline.advanced')}
      </label>

      {advanced && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '10px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '6px',
            }}
          >
            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>
              {t('situation.timeline.scrubberLabel')}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {min !== null && max !== null ? new Date(value).toLocaleDateString() : '—'}
            </span>
          </div>
          <input
            type="range"
            min={min ?? 0}
            max={max ?? 0}
            step={86400000}
            value={value}
            disabled={disabled}
            onChange={(e) => onScrub(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#3b82f6',
              cursor: disabled ? 'default' : 'pointer',
            }}
          />
          {min !== null && max !== null && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#64748b',
                fontSize: '11px',
                marginTop: '4px',
              }}
            >
              <span>{new Date(min).toLocaleDateString()}</span>
              <span>{new Date(max).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
