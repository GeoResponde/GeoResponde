# Venezuela Reporta adapter

Dual-capability adapter for the Venezuela Reporta open API
(`https://venezuelareporta.org/api/v1`, 120 req/min, attribution **required**).

- **Search** (`GET /personas`): federated read, normalized by `parser.ts`.
- **Submission** (`POST /personas`): registers a missing person, mapped by
  `mapper.ts`. Ships **dry-run by default**; a live POST fires only behind an
  explicit env opt-in (see below).

## Submission mapping (`mapper.ts`)

`Report(missing-person)` → VR create body:

| VR field    | Source                     | Notes                                        |
| ----------- | -------------------------- | -------------------------------------------- |
| `status`    | fixed `'buscando'`         | VR rejects `fallecido` on create.            |
| `nombre`    | `fields.fullName`          | **Required** — absent → `status:'error'`, no POST. |
| `ciudad`    | `fields.lastSeenLocation`  | **Required by VR** — absent → `status:'error'`, no POST. |
| `ultima_vez`| `fields.lastSeenLocation`  | Free-text last-seen hint.                    |
| `cedula`    | `fields.cedula`            | Optional. PII — sent to VR, never previewed/logged. |
| `genero`    | `fields.gender`            | `female→femenino`, `male→masculino`, else omitted. |
| `edad`      | `fields.age`               | Omitted when non-numeric.                    |
| `origen_id` | idempotency key            | So a resubmit UPDATEs instead of duplicating. |

`zona` and `descripcion` are intentionally omitted.

## PII handling

Venezuela Reporta IS a consented person registry that accepts a cédula, so the
cédula IS placed into the outbound body and sent on the live path. It is
nonetheless PII: `redactSubmissionBody()` strips it from the dry-run preview,
every error path, and anything returned in our HTTP response envelope. The live
path returns only a receipt. Audit-lite stays PII-free (the gateway logs only a
salted hash of the report key, never fields).

## Live send guard (no accidental sends)

A real `POST` fires ONLY when ALL hold:

1. `submit()` is called with `dryRun === false`, AND
2. `process.env.GEORESPONDE_SUBMIT_LIVE === '1'`, AND
3. `process.env.VENEZUELAREPORTA_API_KEY` is set (sent as the `x-api-key` header).

Any missing condition falls back to a dry-run preview (or `skipped` when a live
send was explicitly requested but unconfigured).

## HTTP handling

| Status  | Outcome                                  |
| ------- | ---------------------------------------- |
| `201`   | `ok` (published)                         |
| `202`   | `ok` (pending)                           |
| `400`   | `error`                                  |
| `401/403` | `error` (key)                          |
| `429`   | `error`, `retryable: true`               |

`receipt.url` = the response `ficha_url` when present.

## Env vars (live path only)

| Var | Source |
| --- | --- |
| `VENEZUELAREPORTA_API_KEY` | Venezuela Reporta API key (sent as `x-api-key`) |
| `GEORESPONDE_SUBMIT_LIVE`  | Set to `1` to allow a real POST; unset/`0` keeps dry-run |

No credentials are committed. Dry-run works with none of these set.
