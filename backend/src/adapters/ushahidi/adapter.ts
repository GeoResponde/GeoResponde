import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  ReportTopic,
  SubmissionMode,
  SubmissionResult,
} from '@georesponde/shared';
import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import { postJson } from '../../transports/rest/postClient.js';
import { buildUshahidiPost } from './mapper.js';

/**
 * Ushahidi Platform v5 submission adapter (REP-07). Maps a canonical `Report`
 * onto `POST /api/v5/posts` (see ./README.md for the verified contract) and
 * ships **dry-run by default**. A live POST fires ONLY behind an explicit env
 * opt-in — see {@link UshahidiAdapter.submit}. No secrets are logged.
 */
export class UshahidiAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  submissionMode: SubmissionMode = 'api';
  submissionTopics: readonly ReportTopic[] = [
    'missing-person',
    'resource-need',
    'shelter-status',
  ];
  retryable = true;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  /** Ushahidi is a submission-only target here (no read federation). */
  async search(): Promise<NormalizedSearchResult[]> {
    return [];
  }

  async submit(report: Report, opts: SubmitOptions = {}): Promise<SubmissionResult> {
    // Never log report.fields, the body, the cédula, or the token.
    const dryRun = opts.dryRun ?? true; // dry-run is the DEFAULT
    const formId = process.env.USHAHIDI_FORM_ID ?? '<form-id>';
    const body = buildUshahidiPost(report, formId);

    if (dryRun) {
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'ok',
        idempotencyKey: opts.idempotencyKey,
        preview: body,
      };
    }

    // Live path: fire ONLY when explicitly enabled AND fully configured.
    const deploymentUrl = process.env.USHAHIDI_DEPLOYMENT_URL;
    const token = process.env.USHAHIDI_TOKEN;
    const liveEnabled = process.env.GEORESPONDE_SUBMIT_LIVE === '1';

    if (!liveEnabled || !deploymentUrl || !token) {
      // Live requested but not configured/allowed → never send.
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'skipped',
        idempotencyKey: opts.idempotencyKey,
        preview: body,
      };
    }

    const url = `${deploymentUrl.replace(/\/$/, '')}/api/v5/posts`;
    const submittedAt = new Date().toISOString();

    try {
      const { status, body: resBody } = await postJson<{ result?: { id?: number | string }; id?: number | string }>(
        url,
        body,
        {
          idempotencyKey: opts.idempotencyKey,
          headers: { Authorization: `Bearer ${token}` },
          retryable: true,
        },
      );

      if (status >= 200 && status < 300) {
        const remoteId = resBody?.result?.id ?? resBody?.id;
        return {
          provider: this.provider.id,
          mode: 'live',
          status: 'ok',
          idempotencyKey: opts.idempotencyKey,
          submittedAt,
          retryable: true,
          receipt: {
            remoteId: remoteId != null ? String(remoteId) : undefined,
            timestamp: submittedAt,
          },
        };
      }

      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        idempotencyKey: opts.idempotencyKey,
        submittedAt,
        retryable: true,
        error: `Ushahidi responded ${status}`,
      };
    } catch {
      // Do not surface the raw error (may echo the body/URL). PII-free message.
      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        idempotencyKey: opts.idempotencyKey,
        submittedAt,
        retryable: true,
        error: 'Ushahidi submission failed (network/transport error)',
      };
    }
  }
}
