# Deployment

GeoResponde has two deployable pieces:

1. **Frontend** — a static Vite/React build (the map + Find/Situation/Report UI).
2. **Provider Gateway** — the Fastify backend that federates providers (`/api/search`, `/api/providers`, `/api/dev/inspect/:id`).

The frontend talks to the gateway through `VITE_API_URL`. Historically the
frontend hardcoded `http://127.0.0.1:3001`, so **Find only worked locally**.
That is now an environment variable, so the public demo can point at a deployed
gateway.

## 1. Deploy the Provider Gateway

The gateway is serverless-ready: `backend/src/index.ts` exports `buildApp()` and
only starts a long-lived server when run directly. `backend/api/index.ts` is a
Vercel Node function that wraps the app.

**Vercel (recommended):**
- Create a project whose **root directory** is `backend/`.
- Framework preset: *Other*. Build command: `pnpm build`. Output: none (functions only).
- Vercel serves `backend/api/index.ts` at `/api/*`.
- No environment variables are required to start; providers initialize on first request.

**Any Node host (Render, Fly, Railway, a VM):**
- `pnpm --filter @georesponde/backend build && node backend/dist/index.js`
- Honors `PORT` (defaults to `3001`). Health check: `GET /api/health`.

Note: some provider adapters embed public (publishable) Supabase keys that the
source sites rotate between deploys; if a provider starts returning empty/errors
on the health dashboard, its key may need re-extracting (documented per adapter).

## 2. Deploy the Frontend

- Create a Vercel project with **root directory** `frontend/`.
- **CRITICAL:** Set the environment variable **`VITE_API_URL`** in your deployment provider (e.g., Vercel Environment Variables) to the gateway URL from step 1 (e.g. `https://georesponde-gateway.vercel.app`).
  - *Note: Vite requires this variable at **build time**. If it is missing, the application will fail fast during startup if the variable was missing during the build.*
- Build command: `pnpm build`. Output directory: `dist`.
- `frontend/vercel.json` already rewrites all routes to `index.html` (SPA).

## 3. Verify

- Open the deployed frontend, go to **Find**, search a name — results should load
  from the deployed gateway (not localhost).
- Open `/dev/providers` — the health dashboard should show providers as Live.

## CORS

The gateway currently reflects any origin (`origin: true`). For a locked-down
production deployment, restrict it to the frontend's domain in `buildApp()`.
