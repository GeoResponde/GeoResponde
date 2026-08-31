import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  CandidateEntity,
  SubmissionReport,
  SubmissionResult,
  summarize,
} from '@georesponde/shared';
import { BaseAdapter, isSubmissionCapable } from '../adapters/BaseAdapter.js';
import { createAdapter } from '../adapters/registry.js';
import { isCedula, normalizeCedula } from '../adapters/person.js';
import { resolutionIndex } from '../resolution/ResolutionIndex.js';
import { submissionCapabilities, type CapabilitiesByTopic } from './capabilities.js';
import { executeSearchPipeline } from '../search/pipeline/searchPipeline.js';
import { newReportKey, deriveKey, hashKey } from './idempotency.js';
import type { HealthTracker } from './health/HealthTracker.js';

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
  private healthTracker?: HealthTracker;
  /**
   * Structured logger for the audit-lite line. Defaults to console so the
   * gateway stays usable standalone; the HTTP app injects Fastify's pino logger.
   */
  private log: AuditLogger = { info: (obj: unknown) => console.log(obj) };

  /** Inject a structured logger (e.g. Fastify's pino) for audit-lite lines. */
  setLogger(logger: AuditLogger) {
    this.log = logger;
  }

  setHealthTracker(tracker: HealthTracker) {
    this.healthTracker = tracker;
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
      
      if (process.env.NODE_ENV !== 'production') {
        this.providers.push({
          id: 'mock-resolution',
          display_name: 'Mock Resolution Tester',
          description: 'A local development provider to test the Resolution Index.',
          website: 'http://localhost',
          logo: '',
          status: 'active',
          adapter: 'MockResolutionAdapter',
          capabilities: ['search'],
        });
      }

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

  async search(query: string, domain?: string): Promise<any[]> {
    const searchPromises: Promise<NormalizedSearchResult[]>[] = [];
    
    for (const [id, adapter] of this.adapters.entries()) {
      if (adapter.provider.capabilities.includes('search')) {
        const searchPromise = (async () => {
          const startedAt = Date.now();
          try {
            const results = await adapter.search(query, domain);
            const elapsedMs = Date.now() - startedAt;
            
            if (this.healthTracker) {
              const status = results.length > 0 ? 'ok' : 'empty';
              let newestObservationAt: number | undefined;
              let oldestObservationAt: number | undefined;
              
              if (results.length > 0) {
                const timestamps = results
                  .map(r => r.last_update ? new Date(r.last_update).getTime() : undefined)
                  .filter((t): t is number => t !== undefined && !isNaN(t));
                  
                if (timestamps.length > 0) {
                  newestObservationAt = Math.max(...timestamps);
                  oldestObservationAt = Math.min(...timestamps);
                }
              }

              this.healthTracker.record(id, status, elapsedMs, Date.now(), { newestObservationAt, oldestObservationAt });
            }
            
            return results;
          } catch (e: any) {
            console.error(`[Gateway] Provider ${id} search failed:`, e);
            if (this.healthTracker) {
              this.healthTracker.record(id, 'error', Date.now() - startedAt, Date.now(), { errorDetail: e?.message ?? String(e) });
            }
            return [];
          }
        })();
        searchPromises.push(searchPromise);
      }
    }

    const resultsArray = await Promise.all(searchPromises);
    const results = resultsArray.flat();

    // The Search Pipeline now handles intent detection, 
    // resolution routing, unified ranking, and explainability.
    return executeSearchPipeline(query, results, this.providers);
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

  /**
   * Per-topic submission capabilities (#42): which providers can receive each
   * report topic, so the frontend can tell the user what is actually available.
   */
  getSubmissionCapabilities(): CapabilitiesByTopic {
    return submissionCapabilities([...this.adapters.values()]);
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
   * Ids of currently registered/active adapters (Phase 18 / HEALTH-12). This
   * is the correct fan-out source for the health probe — unlike
   * `getProviders()`, which returns the full catalog including inactive
   * providers with no adapter to probe.
   */
  getProviderIds(): string[] {
    return [...this.adapters.keys()];
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
      
      let newestObservationAt: number | undefined;
      let oldestObservationAt: number | undefined;
      
      if (results.length > 0) {
        const timestamps = results
          .map(r => r.last_update ? new Date(r.last_update).getTime() : undefined)
          .filter((t): t is number => t !== undefined && !isNaN(t));
          
        if (timestamps.length > 0) {
          newestObservationAt = Math.max(...timestamps);
          oldestObservationAt = Math.min(...timestamps);
        }
      }

      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'ok' as const,
        normalizedResults: results.length,
        elapsedMs: Date.now() - startedAt,
        sample: results.slice(0, 3),
        newestObservationAt,
        oldestObservationAt
      };
    } catch (err: any) {
      return {
        providerId,
        provider: adapter.provider.display_name,
        query,
        status: 'error' as const,
        elapsedMs: Date.now() - startedAt,
        error: err?.message ?? String(err),
        errorDetail: err?.message ?? String(err),
      };
    }
  }
}
