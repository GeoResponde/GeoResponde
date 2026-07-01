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

// Generic provider inspector: works for any registered provider by catalog id
// (e.g. /api/dev/inspect/prov-hdx?q=venezuela). See CONTRIBUTING.md step 7.
fastify.get('/api/dev/inspect/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const query = (request.query as any).q || 'Maria'
  return gateway.inspect(id, query)
})

import { VenezuelaTeBuscaAdapter } from './adapters/venezuelatebusca/adapter.js'

fastify.get('/api/dev/inspect-legacy/venezuelatebusca', async (request, reply) => {
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
