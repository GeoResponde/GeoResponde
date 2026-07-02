import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  ReportTopic,
  SubmissionMode,
  SubmissionResult,
} from '@georesponde/shared';

/**
 * Options accepted by an adapter's `submit`. Optional and backward-compatible:
 * existing one-arg adapter implementations still satisfy the interface.
 */
export interface SubmitOptions {
  /** When true, produce an outbound-payload preview instead of sending. */
  dryRun?: boolean;
  /** Per-provider derived idempotency key to echo back / send as a header. */
  idempotencyKey?: string;
}

export interface BaseAdapter {
  provider: HumanitarianProvider;
  search(query: string, domain?: string): Promise<NormalizedSearchResult[]>;
  submit(report: Report, opts?: SubmitOptions): Promise<SubmissionResult>;

  /**
   * Optional SubmissionCapability metadata. Real adapters gain this in Phase 11;
   * Phase 10 proves the router with the Mock adapter. An adapter counts as a
   * submission target only when it declares `submissionTopics` (see
   * {@link isSubmissionCapable}).
   */
  submissionMode?: SubmissionMode;
  submissionTopics?: readonly ReportTopic[];
  retryable?: boolean;

  /**
   * Optional read-source hook: adapters that federate a live GeoJSON layer
   * (e.g. terremotovenezuela damaged buildings) expose it here so the gateway
   * can proxy it. Purely additive — search/submit adapters may omit it.
   */
  getGeoJSON?(): Promise<any>;
}

/**
 * True when an adapter can receive submissions: it advertises the `submission`
 * capability AND declares at least one `submissionTopics` entry to route on.
 */
export function isSubmissionCapable(a: BaseAdapter): boolean {
  return (
    a.provider.capabilities.includes('submission') &&
    Array.isArray(a.submissionTopics) &&
    a.submissionTopics.length > 0
  );
}
