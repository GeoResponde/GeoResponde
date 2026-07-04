# Deployment

GeoResponde is deployed as two independent applications:

1. **Frontend** — a static Vite/React single-page app.
2. **Provider Gateway** — a Fastify backend that federates federated search, provider discovery, and report submission.

The frontend and gateway are connected only by an API URL: `VITE_API_URL`.
This keeps the UI separate from the federation backend and allows each piece to
scale and deploy on its own.

## Architecture

- `frontend/` builds a static web app. The build output is `frontend/dist`.
- `backend/` runs the Provider Gateway and exposes API routes under `/api/*`.
- `backend/api/index.ts` is a Vercel serverless wrapper for the Fastify app.
- The gateway also exposes a root health endpoint at `/health` and a liveness
  route at `/api/health`.
- The frontend reads `VITE_API_URL` at build time and defaults to
  `http://localhost:3001` for local development.

## Vercel

### Backend

- Deploy `backend/` as its own Vercel project.
- Root directory: `backend/`.
- Framework preset: *Other*.
- Install: `pnpm install`
- Build command: `pnpm --filter @georesponde/backend build`
- Output: none (Vercel functions only)
- Entrypoint: `backend/api/index.ts` becomes the serverless `/api/*` function.

The gateway initialization is lazy: `buildApp()` creates the Fastify app once,
and the Vercel function forwards requests to it after the instance is ready.

### Frontend

- Deploy `frontend/` as its own Vercel project.
- Root directory: `frontend/`.
- Build command: `pnpm --filter @georesponde/frontend build`
- Output directory: `dist`
- Set `VITE_API_URL` to the deployed backend gateway URL.
- `frontend/vercel.json` already rewrites all client-side routes to `index.html`.

### Recommended Vercel flow

- Connect each project to the repository.
- Set the project branch to `main` for production deploys.
- Use Vercel environment variables to provide the published backend URL to the frontend.
- Use `frontend/.env.example` as a reference for the required variable.

## Railway and generic Node hosting

The Provider Gateway can also run on Railway, Render, Fly, a VM, or any Node host.
This is useful when a serverless deployment is not desired.

### Backend on Railway

- Build the backend: `pnpm --filter @georesponde/backend build`
- Start the backend: `node backend/dist/index.js` or `pnpm --filter @georesponde/backend start`
- Railway should install dependencies at the monorepo root with `pnpm install`.
- The gateway honors `PORT`; if unset, it listens on `3001`.

### Generic Node host

- `pnpm --filter @georesponde/backend build && node backend/dist/index.js`
- Confirm the health check: `GET /health` or `GET /api/health`.

The frontend can still be hosted separately on any static site host, as long as
`VITE_API_URL` points at the deployed gateway.

## Environment variables

### Frontend

- `VITE_API_URL`
  - Base URL of the deployed Provider Gateway API.
  - Example: `https://georesponde-gateway.vercel.app`
  - When not set, the frontend falls back to `http://localhost:3001`.

### Backend

- `PORT`
  - Port for the backend to listen on when running as a long-lived process.
  - Default: `3001`.

- `CORS_ALLOWED_ORIGINS`
  - Optional production allowlist of allowed frontend origins.
  - Format: comma-separated origins.
  - If unset, the gateway reflects any origin, which is convenient for local development.

- `GEO_AUDIT_SALT`
  - Optional per-deployment salt used by backend idempotency hashing.

- `GEORESPONDE_SUBMIT_LIVE`
  - Set to `1` to opt into live submissions for adapters that support live POSTs.
  - Default behavior is dry-run.

- Provider-specific env vars
  - Some adapters require extra deployment secrets for live submission integration.
  - Example: `USHAHIDI_DEPLOYMENT_URL`, `USHAHIDI_TOKEN`, `USHAHIDI_FORM_ID`.
  - These are documented in the relevant adapter README files.

## Local development

### Setup

From the repo root:

```bash
pnpm install
```

### Run the backend and frontend

Option 1: Run both apps in parallel from the root:

```bash
pnpm dev
```

Option 2: Run them individually:

```bash
pnpm --filter @georesponde/backend dev
pnpm --filter @georesponde/frontend dev
```

### Local API configuration

- The frontend uses `frontend/.env.development` to set:

```bash
VITE_API_URL=http://127.0.0.1:3001
```

- If you start the backend on a different port, update `VITE_API_URL` or set it
  in `frontend/.env.local`.

### CORS behavior

- Development default: `CORS_ALLOWED_ORIGINS` is unset, so the gateway reflects any origin.
- This means `localhost:5173` can call `localhost:3001` without a CORS error.
- In production, set `CORS_ALLOWED_ORIGINS` to the exact frontend origin(s).

## CI

GeoResponde uses GitHub Actions for continuous integration.

Workflow: `.github/workflows/ci.yml`

- Triggers on `push` and `pull_request` to `main`.
- Uses Node 20 and pnpm 9.
- Runs:
  - `pnpm install`
  - `pnpm run build`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run catalog:validate`
  - `node scripts/check-i18n-parity.mjs`

The CI job verifies that the repo builds cleanly, the catalog is valid, and
internationalization parity is preserved.

## Release process

GeoResponde follows a release workflow centered on the `main` branch and
`CHANGELOG.md`.

- Keep the changelog up to date using the project’s release notes format.
- Update the root `package.json` version when preparing a new release.
- Open a PR against `main` and make sure CI passes.
- Merge to `main`.
- If Vercel is connected to the repository, the backend and frontend projects can
  auto-deploy from `main`.
- Optionally create a Git tag for the release commit.

### Recommended release steps

1. Branch from `main`.
2. Implement the change and update `CHANGELOG.md`.
3. Run the full CI locally: `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run catalog:validate`.
4. Open a pull request and wait for CI approval.
5. Merge into `main`.
6. Deploy the frontend and backend via hosting provider or tag a release commit.

## Verification

- On a deployed frontend, verify the **Find** flow resolves data from the live gateway.
- Confirm the deployed gateway responds at `/api/health` and `/health`.
- If the frontend is served from a different domain than the gateway, confirm
  `CORS_ALLOWED_ORIGINS` includes the frontend origin.
