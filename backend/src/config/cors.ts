/**
 * Resolve the CORS `origin` option for the Provider Gateway.
 *
 * Local development stays friction-free: when `CORS_ALLOWED_ORIGINS` is not set
 * the gateway reflects any request origin (equivalent to the previous
 * `origin: true`), so a contributor running the frontend on any localhost port
 * never hits a CORS wall. In a deployed environment you set
 * `CORS_ALLOWED_ORIGINS` to a comma-separated allowlist and the gateway
 * restricts responses to those origins.
 *
 * Examples:
 *   CORS_ALLOWED_ORIGINS unset            -> true (reflect any origin, dev default)
 *   CORS_ALLOWED_ORIGINS="https://a.app"  -> ["https://a.app"]
 *   CORS_ALLOWED_ORIGINS="https://a.app, https://b.app" -> ["https://a.app", "https://b.app"]
 */
/**
 * SEC-06: a production deploy that forgets to set `CORS_ALLOWED_ORIGINS` falls
 * back to the permissive dev default silently — surface that with a visible
 * warning instead, so it's a conscious choice rather than an oversight.
 */
function warnIfPermissiveInProduction(
  env: NodeJS.ProcessEnv,
  log: { warn: (msg: string) => void } = console,
): void {
  if (env.NODE_ENV === 'production') {
    log.warn(
      '[cors] CORS_ALLOWED_ORIGINS is unset in production — reflecting any request origin. Set it to a comma-separated allowlist to restrict this.',
    );
  }
}

export function resolveCorsOrigin(
  env: NodeJS.ProcessEnv = process.env,
): true | string[] {
  const raw = env.CORS_ALLOWED_ORIGINS?.trim();
  if (!raw) {
    warnIfPermissiveInProduction(env);
    return true;
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // A value that is only commas/whitespace carries no real origin; fall back to
  // the permissive dev default rather than silently blocking every request.
  if (origins.length === 0) {
    warnIfPermissiveInProduction(env);
    return true;
  }
  return origins;
}
