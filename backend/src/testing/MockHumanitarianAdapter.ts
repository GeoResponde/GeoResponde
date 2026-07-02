import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  ReportTopic,
  SubmissionMode,
  SubmissionPackage,
  SubmissionResult,
  REPORT_TOPICS,
} from '@georesponde/shared';
import { BaseAdapter, SubmitOptions } from '../adapters/BaseAdapter.js';

/** Every declared report topic — the Mock's default submission surface. */
const ALL_TOPICS: readonly ReportTopic[] = Object.keys(REPORT_TOPICS) as ReportTopic[];

export interface MockAdapterOptions {
  /** Override the topics this Mock accepts (defaults to all three). */
  submissionTopics?: readonly ReportTopic[];
  /** When true, `submit` rejects so the router's isolation can be tested. */
  failSubmit?: boolean;
  submissionMode?: SubmissionMode;
  retryable?: boolean;
}

export class MockHumanitarianAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  submissionMode: SubmissionMode;
  submissionTopics: readonly ReportTopic[];
  retryable: boolean;
  private readonly failSubmit: boolean;

  constructor(provider: HumanitarianProvider, options: MockAdapterOptions = {}) {
    this.provider = provider;
    this.submissionMode = options.submissionMode ?? 'api';
    this.submissionTopics = options.submissionTopics ?? ALL_TOPICS;
    this.retryable = options.retryable ?? true;
    this.failSubmit = options.failSubmit ?? false;
  }

  async search(query: string, domain?: string): Promise<NormalizedSearchResult[]> {
    console.log(`[Mock] Searching provider ${this.provider.id} for "${query}"`);

    // Simulate latency
    await new Promise((r) => setTimeout(r, Math.random() * 500 + 100));

    // Return fake results matching query
    if (query.length < 3) return [];

    return [
      {
        provider: this.provider.display_name,
        provider_id: this.provider.id,
        type: 'person',
        title: `Result for ${query}`,
        subtitle: 'Last seen nearby',
        url: `${this.provider.website}search?q=${encodeURIComponent(query)}`,
        last_update: new Date().toISOString(),
      },
      {
        provider: this.provider.display_name,
        provider_id: this.provider.id,
        type: 'shelter',
        title: `Shelter related to ${query}`,
        subtitle: 'At 50% capacity',
        url: `${this.provider.website}shelters/1`,
        last_update: new Date().toISOString(),
      },
    ];
  }

  /**
   * Map a canonical Report onto a native-ish provider payload. Demonstrates the
   * per-adapter mapper seam (real `mapper.ts` files are Phase 11). Only the
   * declared topic fields are carried; nothing is logged here.
   */
  buildPackage(report: Report, idempotencyKey: string): SubmissionPackage {
    const def = REPORT_TOPICS[report.topic];
    const payload: Record<string, unknown> = { idempotencyKey };
    if (def) {
      for (const field of def.fields) {
        if (field.name in report.fields) {
          payload[field.name] = report.fields[field.name];
        }
      }
    }
    return {
      type: report.topic,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  async submit(report: Report, opts: SubmitOptions = {}): Promise<SubmissionResult> {
    // Never log report.fields — may carry sensitive PII (cédula, contact).
    console.log(`[Mock] Submitting ${report.topic} report to provider ${this.provider.id}`);

    if (this.failSubmit) {
      throw new Error('mock submit failure');
    }

    const idempotencyKey = opts.idempotencyKey;

    if (opts.dryRun) {
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'ok',
        idempotencyKey,
        preview: this.buildPackage(report, idempotencyKey ?? ''),
      };
    }

    const timestamp = new Date().toISOString();
    return {
      provider: this.provider.id,
      mode: 'live',
      status: 'ok',
      idempotencyKey,
      submittedAt: timestamp,
      receipt: {
        remoteId: `mock-${this.provider.id}-${Date.now()}`,
        url: `${this.provider.website}reports/mock`,
        timestamp,
      },
    };
  }
}
