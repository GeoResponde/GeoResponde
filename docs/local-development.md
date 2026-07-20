# Local Development and CORS

This guide covers running the Provider Gateway (backend) and the web app (frontend) on your machine, pointing the frontend at your local gateway, and avoiding CORS errors while you do it.

## The short version

1. Start the backend. It listens on port `3001` by default.
2. Point the frontend at it with `VITE_API_URL=http://localhost:3001`.
3. Leave `CORS_ALLOWED_ORIGINS` unset in development. The gateway then reflects any origin, so any localhost port works with no extra setup.

That is enough for local work. The rest of this page explains each step and how CORS behaves in production.

## Run the backend

From the repo root:

```bash
pnpm --filter backend dev
```

The gateway starts on `http://localhost:3001`. You can override the port with the `PORT` environment variable:

```bash
PORT=4000 pnpm --filter backend dev
```

A quick health check confirms it is up:

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

## Point the frontend at your gateway

The frontend reads its API base from `VITE_API_URL` at build/start time. If it is not set, the app falls back to `http://localhost:3001`, which matches the backend default, so in the common case you do not need to set anything.

To target a different gateway (for example a non-default port or a deployed instance), create `frontend/.env.local`:

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:3001
```

Then start the frontend:

```bash
pnpm --filter frontend dev
```

If you change `VITE_API_URL`, restart the frontend dev server so Vite picks up the new value.

## How CORS works here

The gateway configures CORS from a single environment variable, `CORS_ALLOWED_ORIGINS`:

- **Unset (development default):** the gateway reflects any request origin. Any `localhost` port can call the API, so you will not hit a CORS wall while developing.
- **Set to a comma-separated allowlist (production):** the gateway only allows those origins. For example:

  ```bash
  CORS_ALLOWED_ORIGINS="https://georesponde.example.com,https://www.georesponde.example.com"
  ```

This keeps local development open and low-friction while letting a deployment restrict the API to its own domains. The resolver that reads this variable lives in `backend/src/config/cors.ts` and is unit tested.

## Common CORS pitfalls

- **Frontend and backend on different ports is fine in dev.** With `CORS_ALLOWED_ORIGINS` unset the gateway reflects your origin, so a mismatched port is not the problem. If you set the variable locally, remember it now restricts origins, and your frontend origin must be in the list.
- **A CORS error after deploying** usually means `CORS_ALLOWED_ORIGINS` is set on the server but does not include the exact frontend origin (scheme, host, and port must all match). Add the exact origin to the list.
- **`VITE_API_URL` pointing at the wrong place** looks like a CORS or network error in the browser console. Confirm it matches where the backend is actually listening.


## Diagnostics & Telemetry Dashboard
You can view real-time latency graphs, adapter IDs, and failure statistics by visiting the developer health dashboard:
* **Canonical URL**: `http://localhost:5173/dev/providers`
* **Redirect URL**: `http://localhost:5173/dev/health` (redirects automatically to `/dev/providers`)