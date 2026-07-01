import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { pathToFileURL } from 'url'
import { REPORT_TOPICS, validateReport, type Report, type SubmissionReport, type ReportFieldError } from '@georesponde/shared'
import { ProviderGateway } from './gateway/ProviderGateway.js'
import { VenezuelaTeBuscaAdapter } from './adapters/venezuelatebusca/adapter.js'
import { fetchEonetEvents } from './adapters/eonet/service.js'
import { fetchAidSites } from './adapters/sitios/service.js'
import { fetchUsgsEarthquakes } from './adapters/usgs/service.js'
import { fetchFunvisisEarthquakes } from './adapters/funvisis/service.js'
import { fetchCopernicusProduct } from './adapters/damage/service.js'

/**
 * Build and configure the Provider Gateway HTTP app. Exported so it can run
 * both as a long-lived server (local dev) and inside a serverless function
 * (see backend/api/index.ts). The gateway is initialized lazily on first
 * request so cold serverless invocations work without a separate boot step.
 */
/**
 * Resolve the submission mode from the request query. Dry-run is the SAFE
 * default: only an explicit `dryRun=0` or `dryRun=false` opts into a live send.
 * A missing or garbled param can only fall back to dry-run, never to live.
 */
function parseDryRun(query: unknown): boolean {
  const raw = (query as { dryRun?: string } | undefined)?.dryRun
  if (raw === '0' || raw === 'false') return false
  return true
}

export function buildApp(): FastifyInstance {
  const fastify = Fastify({ logger: true })
  fastify.register(cors, { origin: true })

  const gateway = new ProviderGateway()
  // Route audit-lite submission lines through Fastify's pino logger.
  gateway.setLogger(fastify.log)
  let ready: Promise<void> | null = null
  const ensureReady = () => (ready ??= gateway.initialize())

  fastify.get('/api/health', async () => ({ ok: true }))

  // Deploy/liveness routes (upstream). Root returns service info; /health is a
  // bare liveness probe for the hosting platform's health checks.
  fastify.get('/', async () => ({
    service: 'GeoResponde Provider Gateway',
    version: '0.5.0',
    status: 'operational',
  }))

  fastify.get('/health', async () => ({ status: 'ok' }))

  fastify.get('/api/providers', async () => {
    await ensureReady()
    return gateway.getProviders()
  })

  // Live provider GeoJSON layer proxy (e.g. terremotovenezuela damaged
  // buildings). Resolves the adapter by catalog id and returns its normalized
  // FeatureCollection with the provider's attribution header. Degrade-safe: an
  // unknown provider, an adapter without a layer, or an unreachable upstream all
  // yield an empty FeatureCollection — never a 5xx.
  fastify.get('/api/providers/:id/geojson', async (request, reply) => {
    await ensureReady()
    const { id } = request.params as { id: string }
    const { collection, attribution } = await gateway.getProviderGeoJSON(id)
    if (attribution) reply.header('X-Attribution', attribution)
    return collection
  })

  fastify.get('/api/search', async (request) => {
    await ensureReady()
    const query = (request.query as { q?: string }).q
    if (!query) return []
    return gateway.search(query)
  })

  // Situation map read source (Phase 12, EON-01). Proxies NASA EONET v3
  // /events as cached, pre-sorted GeoJSON. The frontend MUST hit this gateway
  // route, never EONET directly — the volatile TTL cache and the 60 req/min
  // budget live here. Not gated behind ensureReady(): EONET is independent of
  // the provider catalog. Degrades gracefully (X-EONET-Source reflects it),
  // never returns 5xx.
  fastify.get('/api/eonet/events', async (request, reply) => {
    const { status, category, bbox, start, end } = request.query as {
      status?: string
      category?: string
      bbox?: string
      start?: string
      end?: string
    }
    const result = await fetchEonetEvents({ status, category, bbox, start, end })
    reply.header('X-EONET-Source', result.source)
    return result.collection
  })

  // Situation map aid-site layer. Proxies Venezuela Reporta's
  // /api/v1/sitios as cached, pre-shaped GeoJSON. The frontend MUST hit this
  // gateway route, never VR directly — the volatile TTL cache and the 120
  // req/min budget live here. Attribution ("Venezuela Reporta") is required on
  // this data. Degrades gracefully (X-Sitios-Source reflects it), never 5xx.
  fastify.get('/api/sitios', async (request, reply) => {
    const { tipo, municipio } = request.query as {
      tipo?: string
      municipio?: string
    }
    const result = await fetchAidSites({ tipo, municipio })
    reply.header('X-Sitios-Source', result.source)
    reply.header('X-Attribution', 'Venezuela Reporta')
    return result.collection
  })

  // Situation map earthquake layer (priority source). Proxies USGS fdsnws
  // /query as cached, normalized GeoJSON. The frontend MUST hit this gateway
  // route, never USGS directly — the volatile TTL cache lives here. bbox comes
  // from the shared country registry ([W,N,E,S]); start from the timeline
  // preset. Degrades gracefully (X-USGS-Source reflects it), never returns 5xx.
  fastify.get('/api/usgs/earthquakes', async (request, reply) => {
    const { bbox, start } = request.query as { bbox?: string; start?: string }
    const result = await fetchUsgsEarthquakes({ bbox, start })
    reply.header('X-USGS-Source', result.source)
    reply.header('X-Attribution', 'USGS')
    return result.collection
  })

  // Situation map local earthquake layer. Federates the OSS SismosVE feed
  // (official FUNVISIS data, ~5 min refresh) as cached, normalized GeoJSON.
  // FUNVISIS has no official public API (their DB is currently down), so
  // SismosVE is the source of record here. Attribution "FUNVISIS (vía SismosVE)"
  // is REQUIRED and carried on every feature + this header. `start` applies the
  // timeline window. Degrades gracefully (X-FUNVISIS-Source), never 5xx.
  fastify.get('/api/funvisis/earthquakes', async (request, reply) => {
    const { start } = request.query as { start?: string }
    const result = await fetchFunvisisEarthquakes({ start })
    reply.header('X-FUNVISIS-Source', result.source)
    reply.header('X-Attribution', 'FUNVISIS (vía SismosVE)')
    return result.collection
  })

  // Situation map Copernicus EMS damage layers (Phase 14). Proxies the public
  // no-auth Rapid Mapping activation (EMSR884) as cached GeoJSON: `grading` (GRA,
  // building/road damage) and `ground-movement` (GRM, LOS displacement). The
  // frontend MUST hit THIS route, never Copernicus directly — the volatile 6h
  // cache, SSRF host-allowlist guard, and degrade-safe behavior (fresh->stale->
  // empty) all live here, so it NEVER returns 5xx. `:product` is validated against
  // the {grading, ground-movement} allowlist; an unknown product/event yields an
  // empty collection. Attribution (© European Union / Copernicus EMS) is REQUIRED
  // and carried on X-Attribution. Not gated behind ensureReady(): damage is
  // independent of the provider catalog, like the EONET/USGS routes.
  fastify.get('/api/damage/copernicus/:product', async (request, reply) => {
    const { product } = request.params as { product: string }
    const result = await fetchCopernicusProduct(product)
    reply.header('X-Damage-Source', result.source)
    if (result.attribution) reply.header('X-Attribution', result.attribution)
    return result.collection
  })

  // Submission federation router (Phase 10). Accepts a structured Report and
  // fans it out to submission-capable providers via gateway.submit, returning a
  // partial-success SubmissionReport. Submission defaults to DRY-RUN: a live send
  // requires an explicit ?dryRun=0 (or false). Per the owner directive nothing is
  // persisted — GeoResponde is a federator, not a system of record. Sensitive
  // fields (cédula, reporter.contact) are never logged here.
  fastify.post('/api/report', async (request, reply): Promise<SubmissionReport | { error: string; fields?: Record<string, ReportFieldError> }> => {
    const report = request.body as Partial<Report> | undefined
    const topic = report?.topic

    if (!topic || !(topic in REPORT_TOPICS)) {
      reply.code(400)
      return { error: 'unknown topic' }
    }

    // Validate required/typed fields server-side — never trust the client. An
    // empty or malformed report is rejected before it reaches the gateway, so
    // we never forward blank reports to trusted providers.
    const validation = validateReport(topic, report?.fields)
    if (!validation.ok) {
      reply.code(400)
      return { error: 'validation', fields: validation.errors }
    }

    await ensureReady()
    return gateway.submit(report as Report, { dryRun: parseDryRun(request.query) })
  })

  // Generic provider inspector: works for any registered provider by catalog id
  // (e.g. /api/dev/inspect/prov-hdx?q=venezuela). See CONTRIBUTING.md step 7.
  fastify.get('/api/dev/inspect/:id', async (request) => {
    await ensureReady()
    const { id } = request.params as { id: string }
    const query = (request.query as { q?: string }).q || 'Maria'
    return gateway.inspect(id, query)
  })

  fastify.get('/api/dev/inspect-legacy/venezuelatebusca', async (request, reply) => {
    const query = (request.query as { q?: string }).q || 'Maria'
    const diagnostic = {
      rawRequestUrl: `https://venezuelatebusca.com/_root.data?query=${encodeURIComponent(query)}`,
      httpStatus: 0,
      normalizedResults: 0,
      parserErrors: [] as string[],
    }
    try {
      const adapter = new VenezuelaTeBuscaAdapter({
        id: 'venezuela_te_busca',
        display_name: 'Venezuela Te Busca',
        description: 'Search missing persons across Venezuela.',
        website: 'https://venezuelatebusca.com',
        logo: '',
        status: 'active',
        adapter: 'VenezuelaTeBuscaAdapter',
        capabilities: ['search'],
      })
      const results = await adapter.search(query)
      diagnostic.httpStatus = 200
      diagnostic.normalizedResults = results.length
    } catch (err) {
      diagnostic.httpStatus = 500
      diagnostic.parserErrors.push(err instanceof Error ? err.message : String(err))
    }
    reply.send(diagnostic)
  })

  return fastify
}

async function start() {
  const app = buildApp()
  try {
    const port = Number(process.env.PORT) || 3001
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`Provider Gateway listening on port ${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only start a long-lived server when run directly (local dev), not when the
// module is imported by a serverless handler.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start()
}
