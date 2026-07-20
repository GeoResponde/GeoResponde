# Deployment

GeoResponde has two deployable pieces:

1. **Frontend** — a static Vite/React build (the map + Find/Situation/Report UI).
2. **Provider Gateway** — the Fastify backend that federates providers (`/api/search`, `/api/providers`, `/api/dev/inspect/:id`).

The frontend talks to the gateway through `VITE_API_URL`. Historically the
frontend hardcoded `http://127.0.0.1:3001`, so **Find only worked locally**.
That is now an environment variable, so the public demo can point at a deployed
gateway.

Setting up a local copy of the gateway and frontend instead of deploying? See
[Local Development](./local-development.md) — it covers running both
together, `VITE_API_URL`, and CORS in dev.

## 1. Deploy the Provider Gateway

The gateway is serverless-ready: `backend/src/index.ts` exports `buildApp()` and
only starts a long-lived server when run directly. `backend/api/index.ts` is a
Vercel Node function that wraps the app.

**Vercel (recommended):**
- Create a project whose **root directory** is `backend/`.
- Framework preset: *Other*. Build command: `pnpm build`. Output: none (functions only).
- Vercel serves `backend/api/index.ts` at `/api/*`.
- No environment variables are required to start; providers initialize on first request.

**Railway:**
- Create a service from this repo, **root directory** `backend/`.
- Build command: `pnpm --filter @georesponde/backend build`.
- Start command: `node backend/dist/index.js`.
- Railway assigns `PORT` automatically — the gateway honors it (defaults to
  `3001` if unset, which only matters when running the same command outside
  Railway). No environment variables are required to start; providers
  initialize on first request, same as on Vercel.
- Health check path: `GET /api/health`.

**Any other Node host (Render, Fly, a VM):**
- Same build/start commands as Railway above.
- Honors `PORT` (defaults to `3001`). Health check: `GET /api/health`.

Note: some provider adapters embed public (publishable) Supabase keys that the
source sites rotate between deploys; if a provider starts returning empty/errors
on the health dashboard, its key may need re-extracting (documented per adapter).

## 2. Deploy the Frontend

Create a Vercel project with the following configuration to correctly build the frontend and its required workspace packages in the pnpm monorepo.

- **Framework Preset:** Vite
- **Root Directory:** `frontend`
- **Include files outside Root Directory:** Enabled
- **Build Command:** `pnpm --filter @georesponde/frontend... build`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`

### Required Environment Variables
- **`VITE_API_URL`**: Set this to the gateway URL from step 1 (e.g. `https://georesponde-gateway.vercel.app`).
  - *Note: Vite requires this variable at **build time**. If it is missing, the application will fail fast during startup.*

### Why the Filtered Build Command?
GeoResponde is a pnpm workspace monorepo. The frontend application depends on internal workspace packages (`@georesponde/shared`, `@georesponde/client`, etc.) which act as compiled libraries. 

If you use the default `pnpm build` inside the frontend directory, these shared packages are not built first, causing TypeScript to fail with missing module errors. Overriding the build command to `pnpm --filter @georesponde/frontend... build` forces Vercel to build the frontend *and all of its workspace dependencies* in the correct topological order.

### Troubleshooting an Incorrect Deployment
If your Vercel deployment configuration is missing the settings above, you may observe the following symptoms:
- **404 on deep links** (e.g., refreshing `/find`): Caused by an incorrect Framework Preset ("Other" instead of "Vite"), which disables Vercel's automatic SPA `index.html` fallback.
- **`/src/main.tsx` served in production** or **MIME type errors**: Caused by an incorrect Output Directory or Root Directory.
- **Missing workspace packages during build**: Caused by the "Include files outside Root Directory" toggle being disabled, or failing to override the build command to build the dependencies first.

## 3. Verify

- Open the deployed frontend, go to **Find**, search a name — results should load
  from the deployed gateway (not localhost).
- Open `/dev/providers` — the health dashboard should show providers as Live. *(Note: Accessing `/dev/health` will also redirect you automatically to `/dev/providers`)*.

## CORS

The gateway currently reflects any origin (`origin: true`). For a locked-down
production deployment, restrict it to the frontend's domain in `buildApp()`.

## CI

Every push and pull request against `main` runs `.github/workflows/ci.yml`
(GitHub Actions), in order:

1. `pnpm install`
2. `pnpm run build` — builds every workspace package.
3. `pnpm run typecheck` — `tsc --noEmit` across the workspace.
4. `pnpm run lint` — ESLint.
5. `pnpm run test` — Vitest across `backend/`, `frontend/`, and the shared packages.
6. `pnpm run catalog:validate` — validates `public/catalog/*.json` against the catalog schema.
7. `node scripts/check-i18n-parity.mjs` — fails if the `en`/`es` translation bundles drift out of sync.

All seven steps must pass before a PR can merge — this is the actual quality
gate, not a suggestion. Run the same commands locally before opening a PR to
catch failures early.

## Release process

Releases follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html), tracked in
[`CHANGELOG.md`](../CHANGELOG.md) at the repo root. There is no automated
release pipeline yet — cutting a release is a manual, repo-maintainer step:

1. Move the accumulated `## Unreleased` changes (or a fresh summary of what
   merged since the last entry) under a new `## vX.Y.Z` heading in
   `CHANGELOG.md`, with a release date.
2. Categorize changes under `Added` / `Changed` / `Fixed` / etc., per Keep a
   Changelog's format.
3. Commit `CHANGELOG.md` on `main` and tag the commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Redeploy the gateway and frontend (see sections 1-2 above) if the release
   includes changes to either.

Version numbers follow SemVer relative to the project's current pre-1.0 stage
(breaking changes bump the minor, everything else patches) until the project
reaches `v1.0.0`.
