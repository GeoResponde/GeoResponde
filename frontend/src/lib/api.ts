/**
 * Base URL of the Provider Gateway API.
 *
 * Reads `VITE_API_URL` at build time so the same frontend build can point at a
 * local gateway in development and a deployed gateway in production. Falls back
 * to the local dev gateway when the variable is not set.
 *
 * Set it in a `.env` file or in the hosting provider's environment, e.g.:
 *   VITE_API_URL=https://georesponde-gateway.example.com
 */
export const API_BASE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3001';
