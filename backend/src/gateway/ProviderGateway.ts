import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  SubmissionReport,
  SubmissionResult,
  summarize,
} from '@georesponde/shared';
import { BaseAdapter, isSubmissionCapable } from '../adapters/BaseAdapter.js';
import { createAdapter } from '../adapters/registry.js';
import { isCedula, normalizeCedula } from '../adapters/person.js';
import { dedupePersons } from './dedupe.js';
import { newReportKey, deriveKey, hashKey } from './idempotency.js';

// ESM has no __dirname. Derive it from this module's URL so the catalog path
// resolves relative to the compiled file — production-safe on Railway and after
// the TypeScript build — instead of a fragile process.cwd() lookup.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Minimal structured logger the gateway emits audit-lite lines through. */
interface AuditLogger {
  info(obj: unknown): void;
}

export class ProviderGateway {
  private providers: HumanitarianProvider[] = [];
  private adapters: Map<string, BaseAdapter> = new Map();
  /**
   * Structured logger for the audit-lite line. Defaults to console so the
   * gateway stays usable standalone; the HTTP app injects Fastify's pino logger.
   */
  private log: AuditLogger = { info: (obj: unknown) => console.log(obj) };

  /** Inject a structured logger (e.g. Fastify's pino) for audit-lite lines. */
  setLogger(logger: AuditLogger) {
    this.log = logger;
  }

  async initialize() {
    // Resolve the catalog relative to this module's location (reaching the
    // monorepo root), matching main's production-safe approach. Works both in
    // local dev and after the TypeScript build; NOT process.cwd()-based (which
    // was fragile on Railway).
    const catalogPath = path.resolve(__dirname, '../../../public/catalog/providers.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf8');
      this.providers = JSON.parse(content);
      
      for (const p of this.providers) {
        if (p.status !== 'active') continue;

        const adapter = createAdapter(p);
        if (adapter) {
          this.adapters.set(p.id, adapter);
        } else {
          console.warn(`[Gateway] No adapter registered for provider "${p.id}" (adapter: "${p.adapter}"). Skipping.`);
        }
      }
      console.log(`[Gateway] Initialized with ${this.adapters.size} active adapters.`);
    } else {
      console.warn(`[Gateway] Warning: No providers.json found at ${catalogPath}`);
    }
  }

  async search(query: string, domain?: string): Promise<NormalizedSearchResult[]> {
    const searchPromises: Promise<NormalizedSearchResult[]>[] = [];
    
    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.provider.capabilities.includes('search')) {
        searchPromises.push(
          adapter.search(query, domain).catch(e => {
            console.error(`[Gateway] Provider ${id} search failed:`, e);
            return [];
          })
        );
      }
    }

    const resultsArray = await Promise.all(searchPromises);
    const results = resultsArray.flat();

    // Cédula search: when the query is a national ID, providers whose text
    // search accepts the number return the person; keep only exact cédula
    // matches (by digits) so the result set is precise. Masked cédulas that
    // cannot be compared in full are dropped from a cédula search.
    if (isCedula(query)) {
      const target = normalizeCedula(query);
      const matches = results.filter(
        (r) => r.person?.cedula && normalizeCedula(r.person.cedula) === target,
      );
      return dedupePersons(matches);
    }

    // Many of these providers aggregate one another, so the same person is
    // reported by several. Collapse those into one result with provenance.
    return dedupePersons(results);
  }

  /**
   * Submission router (REP-03). Fans one canonical Report out to every
   * submission-capable adapter whose declared topics include the report topic,
   * mirroring search(): filter, Promise.all, per-adapter `.catch()` isolation so
   * a single provider failure can never sink the batch, then roll up into a
   * partial-success SubmissionReport. A federator, never a store — nothing here
   * is persisted. Dry-run default + idempotency keys land in plan 10-02.
   */
  async submit(
    report: Report,
    opts: { dryRun?: boolean; only?: string[] } = {},
  ): Promise<SubmissionReport> {
    const startedAt = Date.now();

    // One report-level key per fan-out; each target gets a distinct derived key.
    const key = newReportKey();
    // Dry-run is the DEFAULT: only an explicit `false` opts into a live send.
    const dryRun = opts.dryRun ?? true;

    const targets: [string, BaseAdapter][] = [];
    for (const [id, adapter] of this.adapters.entries()) {
      if (
        isSubmissionCapable(adapter) &&
        adapter.submissionTopics!.includes(report.topic) &&
        (!opts.only || opts.only.includes(id))
      ) {
        targets.push([id, adapter]);
      }
    }

    const failedResult = (adapter: BaseAdapter, provKey: string): SubmissionResult => ({
      provider: adapter.provider.id,
      mode: 'dry-run',
      status: 'error',
      error: 'submission failed',
      idempotencyKey: provKey,
    });

    const results = await Promise.all(
      targets.map(([id, adapter]) => {
        const provKey = deriveKey(key, id);
        return adapter
          .submit(report, { dryRun, idempotencyKey: provKey })
          .catch(() => failedResult(adapter, provKey));
      }),
    );

    const summary = summarize(results);
    const elapsedMs = Date.now() - startedAt;

    // Audit-lite (REP-05): exactly one PII-free structured line. Only a SALTED
    // hash of the report key (a correlation handle, never the key), the topic,
    // the selected provider ids, the outcome counts, and the elapsed time. NEVER
    // any report field, cédula, contact, coordinate, or constructed URL.
    this.log.info({
      idempotencyKeyHash: hashKey(key),
      topic: report.topic,
      targetProviderIds: targets.map(([id]) => id),
      outcomes: summary,
      elapsedMs,
    });

    return {
      idempotencyKey: key,
      topic: report.topic,
      results,
      summary,
      elapsedMs,
    };
  }

  getProviders() {
    return this.providers;
  }

  /**
   * Proxy a provider's live GeoJSON layer (adapters that federate one expose
   * `getGeoJSON`). Resolves the adapter by catalog id and returns its normalized
   * FeatureCollection plus the provider's attribution label. Degrade-safe:
   * returns an empty FeatureCollection (never throws, never 5xx) when the
   * provider is unknown, exposes no layer, or the upstream is unavailable.
   */
  async getProviderGeoJSON(
    providerId: string,
  ): Promise<{ collection: { type: 'FeatureCollection'; features: unknown[] }; attribution: string }> {
    const empty = { type: 'FeatureCollection' as const, features: [] as unknown[] };
    const adapter = this.adapters.get(providerId);
    if (!adapter || typeof adapter.getGeoJSON !== 'function') {
      return { collection: empty, attribution: '' };
    }
    try {
      const collection = await adapter.getGeoJSON();
      return {
        collection: collection ?? empty,
        attribution: adapter.provider.display_name,
      };
    } catch {
      // Never surface the upstream error/URL; degrade to an empty collection.
      return { collection: empty, attribution: adapter.provider.display_name };
    }
  }

  /**
   * Diagnostic helper for the `/api/dev/inspect/:id` developer endpoint.
   * Runs a single provider's adapter in isolation and reports what came back,
   * so contributors can verify a new integration without booting the whole UI.
   */
  async inspect(providerId: string, query: string) {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      return {
        providerId,
        status: 'not_found' as const,
        error: `No active adapter registered for provider id "${providerId}".`,
        activeProviders: [...this.adapters.keys()],
      };
    }

    const startedAt = Date.now();
    try {
      const results = await adapter.search(query);
      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'ok' as const,
        normalizedResults: results.length,
        elapsedMs: Date.now() - startedAt,
        sample: results.slice(0, 3),
      };
    } catch (err: any) {
      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'error' as const,
        elapsedMs: Date.now() - startedAt,
        error: err?.message ?? String(err),
      };
    }
  }
}
