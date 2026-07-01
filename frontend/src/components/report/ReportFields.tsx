import { REPORT_TOPICS, type ReportFieldDef, type ReportTopic } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

interface ReportFieldsProps {
  topic: ReportTopic;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: '#f8fafc',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  fontSize: '15px',
};

const helperStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#f59e0b',
  marginTop: '6px',
};

/**
 * Renders the inputs for a topic straight from REPORT_TOPICS — the form is
 * registry-driven, so adding a field/topic in @georesponde/shared is enough.
 */
export function ReportFields({ topic, values, onChange }: ReportFieldsProps) {
  const { t } = useTranslation();
  const fields = REPORT_TOPICS[topic].fields;

  const renderInput = (field: ReportFieldDef) => {
    const raw = values[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={field.name}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        );
      case 'number':
        return (
          <input
            id={field.name}
            type="number"
            value={typeof raw === 'number' ? raw : ''}
            onChange={(e) => onChange(field.name, e.target.value === '' ? undefined : Number(e.target.value))}
            style={inputStyle}
          />
        );
      case 'select':
        return (
          <select
            id={field.name}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => onChange(field.name, e.target.value || undefined)}
            style={inputStyle}
          >
            <option value="">—</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {t(`report.options.${opt}`)}
              </option>
            ))}
          </select>
        );
      case 'coords': {
        // Presented as "lat, lng"; stored as a [lng, lat] tuple to match the
        // GeoJSON convention used elsewhere (NormalizedSearchResult.location).
        const tuple = Array.isArray(raw) ? (raw as [number, number]) : undefined;
        const display = tuple ? `${tuple[1]}, ${tuple[0]}` : '';
        return (
          <input
            id={field.name}
            type="text"
            value={display}
            placeholder={t('report.coordsPlaceholder')}
            onChange={(e) => {
              const parts = e.target.value.split(',').map((p) => Number(p.trim()));
              if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
                onChange(field.name, [parts[1], parts[0]]);
              } else {
                onChange(field.name, undefined);
              }
            }}
            style={inputStyle}
          />
        );
      }
      default:
        return (
          <input
            id={field.name}
            type="text"
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} style={labelStyle}>
            {t(`report.fields.${field.name}`)}
            {field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {renderInput(field)}
          {field.sensitive && <p style={helperStyle}>{t('report.sensitiveHelper')}</p>}
        </div>
      ))}
    </div>
  );
}
