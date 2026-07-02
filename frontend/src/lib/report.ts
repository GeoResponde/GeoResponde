import type { Report, SubmissionResult } from '@georesponde/shared';
import { API_BASE } from './api';

/**
 * Submit a composed {@link Report} to the gateway's dry-run report route and
 * return the provider-agnostic {@link SubmissionResult}. This phase is dry-run
 * only — no provider fan-out (that lands in Phase 10). Never log the report
 * body here: it may carry sensitive PII (cédula, reporter contact).
 */
export async function submitReport(report: Report): Promise<SubmissionResult> {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  // Throw on a non-2xx before parsing so callers surface a real error instead of
  // silently treating a 400/500 body as a SubmissionResult. Never log the body.
  if (!response.ok) {
    throw new Error(`Report submission failed (${response.status})`);
  }
  return (await response.json()) as SubmissionResult;
}
