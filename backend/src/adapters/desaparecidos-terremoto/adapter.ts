import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  ReportTopic,
  SubmissionMode,
  SubmissionResult,
} from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { filterAndNormalizePlataformas } from './parser.js';
import { buildDeepLink } from '../../gateway/submissionModes.js';

const PLATAFORMAS_ENDPOINT =
  'https://desaparecidos-terremoto-api.theempire.tech/api/plataformas';

/**
 * Federates the OPEN aid-platform directory (`/api/plataformas`) of
 * Desaparecidos Terremoto Venezuela. The people/missing-persons endpoint is
 * protected by reCAPTCHA v3 and cannot be federated server-to-server, so this
 * adapter only surfaces the directory of help platforms.
 */
export class DesaparecidosTerremotoAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  /**
   * No write API (persons endpoint is reCAPTCHA-blocked). REP-08 tier ladder:
   * the user submits on the provider's OWN domain via a prefilled deep link.
   */
  submissionMode: SubmissionMode = 'deep_link';
  submissionTopics: readonly ReportTopic[] = ['missing-person'];

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      const items = await fetchJson<any[]>(PLATAFORMAS_ENDPOINT, { timeoutMs: 8000 });
      return filterAndNormalizePlataformas(items, query);
    } catch {
      console.error('[DesaparecidosTerremotoAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  /**
   * REP-08 ethical handoff. Performs NO network write and NO scraping — it
   * returns the deep_link tier the USER acts on: a prefilled deep link to the
   * provider's own public form (non-sensitive fields only; the cédula never
   * enters the URL). The constructed URL is never logged server-side.
   *
   * SECURITY: the mailto/manual fallback tiers (which legitimately carry the
   * cédula, per research 03 §2) are rendered CLIENT-SIDE from the report the
   * user already holds — via the same pure builders in `submissionModes.ts` —
   * so no sensitive PII is ever placed into the server response envelope
   * (upholding the PII-free-envelope invariant enforced in the report route).
   * The intake mailto address, when the client renders it, is a documented
   * placeholder: contacto@desaparecidosterremotovenezuela.com.
   */
  async submit(report: Report, opts: SubmitOptions = {}): Promise<SubmissionResult> {
    // The provider's own domain is the deep-link target. We prefill its public
    // report form; the exact form path is unknown, so we target the site root
    // (the user lands on the provider's own form and submits there).
    const deepLinkBase = this.provider.website;

    return {
      provider: this.provider.id,
      mode: 'dry-run',
      status: 'ok',
      idempotencyKey: opts.idempotencyKey,
      action: {
        tier: 'deep_link',
        actionUrl: buildDeepLink(deepLinkBase, report),
      },
    };
  }
}
