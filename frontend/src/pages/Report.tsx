import { useState } from 'react';
import { validateReport, type Report as ReportModel, type ReportTopic, type SubmissionResult } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';
import { TopicSelector } from '../components/report/TopicSelector';
import { ReportFields } from '../components/report/ReportFields';
import { ConsentGate } from '../components/report/ConsentGate';
import { ResultPreview } from '../components/report/ResultPreview';
import { submitReport } from '../lib/report';

export function Report() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState<ReportTopic | null>(null);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validation = topic ? validateReport(topic, fields) : { ok: false, errors: {} };

  const handleTopicChange = (next: ReportTopic) => {
    setTopic(next);
    setFields({});
    setTouched(new Set());
    setResult(null);
  };

  const handleBlur = (name: string) => {
    setTouched((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  };

  const handleFieldChange = (name: string, value: unknown) => {
    setFields((prev) => {
      const next = { ...prev };
      if (value === undefined || value === '') {
        delete next[name];
      } else {
        next[name] = value;
      }
      return next;
    });
  };

  const canSubmit = topic !== null && acknowledgedAt !== null && validation.ok && !submitting;

  const handleSubmit = async () => {
    if (topic === null || acknowledgedAt === null || !validation.ok) return;
    setSubmitting(true);
    setResult(null);

    const contact = fields.reporterContact;
    const report: ReportModel = {
      id: crypto.randomUUID(),
      topic,
      createdAt: new Date().toISOString(),
      fields,
      consent: { targets: [], acknowledgedAt },
      reporter: typeof contact === 'string' && contact ? { contact } : undefined,
    };

    try {
      const submissionResult = await submitReport(report);
      setResult(submissionResult);
    } catch {
      // Do not log the report body (sensitive PII). Surface a generic error.
      setResult({
        provider: 'dry-run',
        mode: 'dry-run',
        status: 'error',
        error: t('report.result.networkError'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '40px 20px',
        maxWidth: '800px',
        margin: '0 auto',
        flex: 1,
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#f8fafc' }}>
          {t('report.title')}
        </h1>
        <p style={{ fontSize: '18px', color: '#94a3b8', margin: 0 }}>{t('report.subtitle')}</p>
      </header>

      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <TopicSelector value={topic} onChange={handleTopicChange} />

        {topic && (
          <>
            <ReportFields
              topic={topic}
              values={fields}
              onChange={handleFieldChange}
              errors={validation.errors}
              touched={touched}
              onBlur={handleBlur}
            />
            <ConsentGate acknowledgedAt={acknowledgedAt} onChange={setAcknowledgedAt} />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: canSubmit ? '#2563eb' : '#334155',
                color: canSubmit ? '#f8fafc' : '#64748b',
                fontSize: '16px',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? t('report.submitting') : t('report.submit')}
            </button>
            {!validation.ok && (
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
                {t('report.errors.formIncomplete')}
              </p>
            )}
          </>
        )}

        {result && <ResultPreview result={result} />}
      </div>
    </div>
  );
}
