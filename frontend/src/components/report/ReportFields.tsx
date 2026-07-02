import { REPORT_TOPICS, type ReportFieldDef, type ReportFieldError, type ReportTopic } from '@georesponde/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReportFieldsProps {
  topic: ReportTopic;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  errors?: Record<string, ReportFieldError>;
  touched?: Set<string>;
  onBlur?: (name: string) => void;
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
const errorStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#ef4444',
  marginTop: '6px',
};

/** Parse a "lat, lng" string into a [lng, lat] tuple, or undefined when invalid. */
function parseCoords(text: string): [number, number] | undefined {
  const parts = text.split(',').map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return [parts[1], parts[0]];
  }
  return undefined;
}

/**
 * Coordinates input. Keeps the in-progress *text* as local state (source of
 * truth for what the user sees) and only lifts the parsed [lng, lat] tuple up
 * when it parses — so a half-typed value like "10." is never erased mid-keystroke.
 * Re-syncs from props only when the external tuple changes to something the
 * current text does not represent (e.g. a programmatic reset).
 */
function CoordsInput({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: unknown;
  placeholder: string;
  onChange: (value: unknown) => void;
}) {
  const tuple = Array.isArray(value) ? (value as [number, number]) : undefined;
  const canonical = tuple ? `${tuple[1]}, ${tuple[0]}` : '';
  const [text, setText] = useState(canonical);

  useEffect(() => {
    const parsed = parseCoords(text);
    const parsedKey = parsed ? `${parsed[0]},${parsed[1]}` : '';
    const extKey = tuple ? `${tuple[0]},${tuple[1]}` : '';
    if (parsedKey !== extKey) setText(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  return (
    <input
      id={id}
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseCoords(e.target.value));
      }}
      style={inputStyle}
    />
  );
}

/**
 * Number input. Keeps the raw text locally so decimals / trailing separators
 * ("1.", "1.5") are not clobbered per keystroke; lifts a parsed Number up (or
 * undefined when empty/invalid) without overwriting the in-progress text.
 */
function NumberInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const canonical = typeof value === 'number' ? String(value) : '';
  const [text, setText] = useState(canonical);

  useEffect(() => {
    const parsed = text.trim() === '' ? undefined : Number(text);
    const parsedKey =
      parsed !== undefined && Number.isFinite(parsed) ? String(parsed) : '';
    if (parsedKey !== canonical) setText(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  return (
    <input
      id={id}
      type="number"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(raw === '' ? undefined : Number(raw));
      }}
      style={inputStyle}
    />
  );
}

export function ReportFields({ topic, values, onChange, errors = {}, touched, onBlur }: ReportFieldsProps) {
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
          <NumberInput
            id={field.name}
            value={raw}
            onChange={(value) => onChange(field.name, value)}
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
      case 'coords':
        // Presented as "lat, lng"; stored as a [lng, lat] tuple to match the
        // GeoJSON convention used elsewhere (NormalizedSearchResult.location).
        return (
          <CoordsInput
            id={field.name}
            value={raw}
            placeholder={t('report.coordsPlaceholder')}
            onChange={(value) => onChange(field.name, value)}
          />
        );
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
      {fields.map((field) => {
        const showError = (touched?.has(field.name) ?? false) && Boolean(errors[field.name]);
        return (
          <div key={field.name} onBlur={() => onBlur?.(field.name)}>
            <label htmlFor={field.name} style={labelStyle}>
              {t(`report.fields.${field.name}`)}
              {field.required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {renderInput(field)}
            {field.sensitive && <p style={helperStyle}>{t('report.sensitiveHelper')}</p>}
            {showError && <p style={errorStyle}>{t(`report.errors.${errors[field.name]}`)}</p>}
          </div>
        );
      })}
    </div>
  );
}
