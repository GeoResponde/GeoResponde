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
  return (await response.json()) as SubmissionResult;
}
