/**
 * Base URL of the Provider Gateway API.
 *
 * Reads `VITE_API_URL` at build time so the same frontend build can point at a
 * local gateway in development and a deployed gateway in production.
 *
 * Set it in a `.env` file or in the hosting provider's environment, e.g.:
 *   VITE_API_URL=https://georesponde-gateway.example.com
 */
let baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

if (!baseUrl) {
  if (import.meta.env.DEV) {
    baseUrl = 'http://localhost:3001';
  } else {
    // Fail fast in production. If this variable is missing during the Vite build,
    // we want to crash rather than silently sending user searches to localhost:3001.
    throw new Error('VITE_API_URL environment variable is required during production build.');
  }
}

export const API_BASE: string = baseUrl;
