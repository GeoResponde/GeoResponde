import Fastify from 'fastify'
import cors from '@fastify/cors'

const fastify = Fastify({ logger: true })

fastify.register(cors, {
  origin: true
})

import { ProviderGateway } from './gateway/ProviderGateway.js'

const gateway = new ProviderGateway()

fastify.get('/api/providers', async (request, reply) => {
  return gateway.getProviders()
})

fastify.get('/api/search', async (request, reply) => {
  const query = (request.query as any).q
  if (!query) return []
  return gateway.search(query)
})

import { SubmissionPackage } from '@georesponde/shared'

fastify.post('/api/submit', async (request, reply) => {
  const payload = request.body as SubmissionPackage
  if (!payload || !payload.type) {
    return reply.status(400).send({ error: 'Missing submission type in payload' })
  }
  const result = await gateway.routeSubmission(payload)
  if (!result.success) {
    return reply.status(500).send({ error: 'Submission failed' })
  }
  return result
})

fastify.get('/api/providers/:id/geojson', async (request, reply) => {
  const { id } = request.params as any
  try {
    const geojson = await gateway.getGeoJSON(id)
    return geojson
  } catch (err: any) {
    return reply.status(404).send({ error: err.message })
  }
})

import { VenezuelaTeBuscaAdapter } from './adapters/venezuelatebusca/adapter.js'

fastify.get('/api/dev/inspect/venezuelatebusca', async (request, reply) => {
  const query = (request.query as any).q || 'Maria'
  
  const diagnostic = {
    rawRequestUrl: `https://venezuelatebusca.com/_root.data?query=${encodeURIComponent(query)}`,
    httpStatus: 0,
    responseSize: 0,
    parsedRecords: 0,
    normalizedResults: 0,
    parserErrors: [] as string[]
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
      capabilities: ['search']
    })
    const results = await adapter.search(query)
    diagnostic.httpStatus = 200 // if no error thrown
    diagnostic.normalizedResults = results.length
    diagnostic.parsedRecords = results.length
  } catch (err: any) {
    diagnostic.httpStatus = 500
    diagnostic.parserErrors.push(err.message)
  }

  reply.send(diagnostic)
})

const start = async () => {
  try {
    await gateway.initialize()
    await fastify.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Provider Gateway listening on port 3001')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
