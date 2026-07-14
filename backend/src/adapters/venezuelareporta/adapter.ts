import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  ReportTopic,
  SubmissionMode,
  SubmissionResult,
} from '@georesponde/shared';
import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import { fetchJson } from '../../transports/rest/client.js';
import { postJson } from '../../transports/rest/postClient.js';
import { parseVenezuelaReportaResponse, VenezuelaReportaResponse } from './parser.js';
import {
  buildVenezuelaReportaSubmission,
  redactSubmissionBody,
} from './mapper.js';

const API_BASE = 'https://venezuelareporta.org/api/v1/personas';

/**
 * Adapter for the Venezuela Reporta open API. Reads `GET /api/v1/personas` for
 * search federation AND writes `POST /api/v1/personas` to register a missing
 * person (dry-run by default; a live POST fires only behind an explicit env
 * opt-in — see {@link VenezuelaReportaAdapter.submit}). Attribution ("Venezuela
 * Reporta") is preserved via the `provider` field on every result, as required
 * by the API terms.
 */
export class VenezuelaReportaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  submissionMode: SubmissionMode = 'api';
  submissionTopics: readonly ReportTopic[] = ['missing-person'];
  retryable = true;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // Never log the query: on a person registry it is a name or cédula (PII).
      const url = `${API_BASE}?q=${encodeURIComponent(query)}&limit=10`;
      const response = await fetchJson<VenezuelaReportaResponse>(url, { timeoutMs: 10000 });

      const normalizedResults = parseVenezuelaReportaResponse(response);

      console.log(`[VenezuelaReportaAdapter] Extracted ${normalizedResults.length} normalized results`);

      return normalizedResults;
    } catch {
      console.error('[VenezuelaReportaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  /**
   * Register a missing person on Venezuela Reporta. Dry-run is the DEFAULT.
   *
   * PII: the cédula IS sent to VR (it is a consented person registry that
   * accepts it), but it is NEVER logged nor returned in our HTTP response
   * envelope — the dry-run preview and every error path go through
   * {@link redactSubmissionBody}, and the live path returns only a receipt.
   *
   * A real POST fires ONLY when ALL hold: `opts.dryRun === false`, AND
   * `GEORESPONDE_SUBMIT_LIVE === '1'`, AND `VENEZUELAREPORTA_API_KEY` is set.
   */
  async submit(report: Report, opts: SubmitOptions = {}): Promise<SubmissionResult> {
    const dryRun = opts.dryRun ?? true; // dry-run is the DEFAULT

    // origen_id = the per-provider idempotency key, so a resubmit UPDATEs.
    const mapped = buildVenezuelaReportaSubmission(report, opts.idempotencyKey);

    if (!mapped.ok) {
      // Missing a VR-required field → never POST. `reason` is PII-free.
      return {
        provider: this.provider.id,
        mode: dryRun ? 'dry-run' : 'live',
        status: 'error',
        idempotencyKey: opts.idempotencyKey,
        error: mapped.reason,
      };
    }

    // The preview NEVER carries the cédula.
    const preview = redactSubmissionBody(mapped.body);

    if (dryRun) {
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'ok',
        idempotencyKey: opts.idempotencyKey,
        preview,
      };
    }

    // Live path: fire ONLY when explicitly enabled AND fully configured.
    const apiKey = process.env.VENEZUELAREPORTA_API_KEY;
    const liveEnabled = process.env.GEORESPONDE_SUBMIT_LIVE === '1';

    if (!liveEnabled || !apiKey) {
      // Live requested but not configured/allowed → never send. PII-free preview.
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'skipped',
        idempotencyKey: opts.idempotencyKey,
        preview,
      };
    }

    const submittedAt = new Date().toISOString();

    try {
      const { status, body: resBody } = await postJson<{
        id?: number | string;
        ficha_url?: string;
      }>(API_BASE, mapped.body, {
        idempotencyKey: opts.idempotencyKey,
        headers: { 'x-api-key': apiKey },
        retryable: true,
      });

      // Any 2xx is a successful acceptance: 201 published, 202 pending, and 200
      // when a resubmit UPDATEs an existing record via origen_id.
      if (status >= 200 && status < 300) {
        const remoteId = resBody?.id;
        const fichaUrl = resBody?.ficha_url;
        return {
          provider: this.provider.id,
          mode: 'live',
          status: 'ok',
          idempotencyKey: opts.idempotencyKey,
          submittedAt,
          retryable: true,
          receipt: {
            remoteId: remoteId != null ? String(remoteId) : undefined,
            url: fichaUrl || undefined,
            timestamp: submittedAt,
          },
        };
      }

      // 429 → transient rate limit, safe to retry later. 400/401/403 → not.
      const retryable = status === 429;
      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        idempotencyKey: opts.idempotencyKey,
        submittedAt,
        retryable,
        error: `Venezuela Reporta responded ${status}`,
      };
    } catch {
      // Never surface the raw error (may echo the body/URL/cédula). PII-free.
      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        idempotencyKey: opts.idempotencyKey,
        submittedAt,
        retryable: true,
        error: 'Venezuela Reporta submission failed (network/transport error)',
      };
    }
  }
}
