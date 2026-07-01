import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from '../src/index.js';

/**
 * Vercel (Node) serverless entry for the Provider Gateway.
 *
 * Deploy the `backend/` directory as its own Vercel project; this file becomes
 * the `/api/*` function. The Fastify app is built once per warm instance and
 * each request is handed to its underlying HTTP server. The gateway itself
 * initializes lazily on the first request (see buildApp()).
 *
 * Configure the frontend's `VITE_API_URL` to point at this deployment's URL.
 */
const app = buildApp();
const ready = app.ready();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ready;
  app.server.emit('request', req, res);
}
