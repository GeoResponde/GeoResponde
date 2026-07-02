import type { SubmissionResult } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

interface ResultPreviewProps {
  result: SubmissionResult;
}

const STATUS_COLOR: Record<SubmissionResult['status'], string> = {
  ok: '#22c55e',
  error: '#ef4444',
  skipped: '#f59e0b',
};

/** Renders the dry-run SubmissionResult returned by the gateway. */
export function ResultPreview({ result }: ResultPreviewProps) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLOR[result.status];

  return (
    <div
      style={{
        marginTop: '28px',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #334155',
        backgroundColor: '#0f172a',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#f8fafc' }}>
        {t('report.result.title')}
      </h3>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#1d4ed822',
            color: '#93c5fd',
            border: '1px solid #1d4ed8',
          }}
        >
          {t('report.result.mode')}: {result.mode}
        </span>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: `${statusColor}22`,
            color: statusColor,
            border: `1px solid ${statusColor}`,
          }}
        >
          {t('report.result.status')}: {result.status}
        </span>
      </div>

      {result.error && <p style={{ color: '#ef4444', fontSize: '14px' }}>{result.error}</p>}

      {result.preview != null && (
        <>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>
            {t('report.result.preview')}
          </p>
          <pre
            style={{
              margin: 0,
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              fontSize: '13px',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(result.preview, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
