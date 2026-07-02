import { describe, it, expect } from 'vitest';
import {
  summarize,
  type SubmissionMode,
  type SubmissionReport,
  type SubmissionResult,
} from '../types.js';

describe('SubmissionMode', () => {
  it('admits the four declared modes', () => {
    const modes: SubmissionMode[] = ['api', 'deep_link', 'mailto', 'manual'];
    expect(modes).toHaveLength(4);
  });
});

describe('SubmissionResult additive extension', () => {
  it('still accepts a bare Phase-9-shaped result (all additions optional)', () => {
    const legacy: SubmissionResult = {
      provider: 'mock',
      mode: 'dry-run',
      status: 'skipped',
    };
    expect(legacy.provider).toBe('mock');
    // The new optional members are absent but the object is valid.
    expect(legacy.idempotencyKey).toBeUndefined();
    expect(legacy.submittedAt).toBeUndefined();
    expect(legacy.retryable).toBeUndefined();
  });

  it('accepts the new optional members and a receipt.timestamp', () => {
    const rich: SubmissionResult = {
      provider: 'mock',
      mode: 'live',
      status: 'ok',
      idempotencyKey: 'derived-key',
      submittedAt: '2026-07-01T00:00:00.000Z',
      retryable: true,
      receipt: {
        remoteId: 'remote-1',
        url: 'https://example.org/r/1',
        timestamp: '2026-07-01T00:00:00.000Z',
      },
    };
    expect(rich.receipt?.timestamp).toBe('2026-07-01T00:00:00.000Z');
    expect(rich.idempotencyKey).toBe('derived-key');
  });
});

describe('summarize', () => {
  it('yields all zeros for an empty results array', () => {
    expect(summarize([])).toEqual({ ok: 0, skipped: 0, error: 0 });
  });

  it('tallies a mixed array by status', () => {
    const results: SubmissionResult[] = [
      { provider: 'a', mode: 'dry-run', status: 'ok' },
      { provider: 'b', mode: 'dry-run', status: 'ok' },
      { provider: 'c', mode: 'dry-run', status: 'skipped' },
      { provider: 'd', mode: 'dry-run', status: 'error' },
    ];
    expect(summarize(results)).toEqual({ ok: 2, skipped: 1, error: 1 });
  });
});

describe('SubmissionReport', () => {
  it('rolls up results with a summary that matches summarize()', () => {
    const results: SubmissionResult[] = [
      { provider: 'a', mode: 'dry-run', status: 'ok' },
      { provider: 'b', mode: 'dry-run', status: 'error' },
    ];
    const report: SubmissionReport = {
      idempotencyKey: 'report-key',
      topic: 'missing-person',
      results,
      summary: summarize(results),
      elapsedMs: 12,
    };
    expect(report.summary).toEqual({ ok: 1, skipped: 0, error: 1 });
    expect(report.results).toHaveLength(2);
    expect(report.topic).toBe('missing-person');
  });
});
