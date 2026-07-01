import { REPORT_TOPICS, type ReportTopic } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

interface TopicSelectorProps {
  value: ReportTopic | null;
  onChange: (topic: ReportTopic) => void;
}

/**
 * Presentational topic picker. Sources its choices from REPORT_TOPICS so new
 * topics show up automatically — no hardcoded per-topic list.
 */
export function TopicSelector({ value, onChange }: TopicSelectorProps) {
  const { t } = useTranslation();
  const topics = Object.keys(REPORT_TOPICS) as ReportTopic[];

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
      {topics.map((topic) => {
        const active = topic === value;
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onChange(topic)}
            style={{
              flex: '1 1 180px',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
              backgroundColor: active ? '#1d4ed8' : '#1e293b',
              color: active ? '#f8fafc' : '#e2e8f0',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
          >
            {t(`report.topics.${topic}`)}
          </button>
        );
      })}
    </div>
  );
}
