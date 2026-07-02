import { useTranslation } from 'react-i18next';

interface ConsentGateProps {
  acknowledgedAt: string | null;
  /** Emits an ISO timestamp when checked, null when unchecked. */
  onChange: (acknowledgedAt: string | null) => void;
}

/**
 * Required consent step. Submit stays disabled until this is acknowledged. The
 * copy states the owner directive: the report is forwarded to external
 * providers and GeoResponde keeps only a receipt, never the report body.
 */
export function ConsentGate({ acknowledgedAt, onChange }: ConsentGateProps) {
  const { t } = useTranslation();
  const checked = acknowledgedAt !== null;

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        borderRadius: '12px',
        border: `1px solid ${checked ? '#22c55e' : '#334155'}`,
        backgroundColor: '#0f172a',
        cursor: 'pointer',
        marginBottom: '24px',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? new Date().toISOString() : null)}
        style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0 }}
      />
      <span style={{ fontSize: '14px', lineHeight: 1.6, color: '#cbd5e1' }}>
        <strong style={{ color: '#f8fafc', display: 'block', marginBottom: '4px' }}>
          {t('report.consent.label')}
        </strong>
        {t('report.consent.text')}
      </span>
    </label>
  );
}
