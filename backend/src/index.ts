import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { pathToFileURL } from 'url'
import { REPORT_TOPICS, type Report, type SubmissionReport } from '@georesponde/shared'
import { ProviderGateway } from './gateway/ProviderGateway.js'
import { VenezuelaTeBuscaAdapter } from './adapters/venezuelatebusca/adapter.js'
import { fetchEonetEvents } from './adapters/eonet/service.js'

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
  let ready: Promise<void> | null = null
  const ensureReady = () => (ready ??= gateway.initialize())

  fastify.get('/api/health', async () => ({ ok: true }))

  fastify.get('/api/providers', async () => {
    await ensureReady()
    return gateway.getProviders()
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

  // Submission federation router (Phase 10). Accepts a structured Report and
  // fans it out to submission-capable providers via gateway.submit, returning a
  // partial-success SubmissionReport. Submission defaults to DRY-RUN: a live send
  // requires an explicit ?dryRun=0 (or false). Per the owner directive nothing is
  // persisted — GeoResponde is a federator, not a system of record. Sensitive
  // fields (cédula, reporter.contact) are never logged here.
  fastify.post('/api/report', async (request, reply): Promise<SubmissionReport | { error: string }> => {
    const report = request.body as Partial<Report> | undefined
    const topic = report?.topic

    if (!topic || !(topic in REPORT_TOPICS)) {
      reply.code(400)
      return { error: 'unknown topic' }
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
