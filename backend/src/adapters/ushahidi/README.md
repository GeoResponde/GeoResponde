# Ushahidi submission adapter (REP-07)

Submission-only adapter that maps a canonical GeoResponde `Report` onto an
Ushahidi Platform **v5** "create post" request. Ships **dry-run by default**: a
live `POST` fires only behind an explicit env opt-in (see below). No secrets are
committed and nothing is logged.

## Endpoint verification (D-05)

Verified on 2026-07-01 against the live Ushahidi sources (the GitBook docs page
is a JS SPA and not machine-scrapable, so the contract was confirmed directly
from the current `ushahidi/platform` `develop` branch source and the public v5
REST docs):

- Docs (overview): <https://docs.ushahidi.com/v3-ushahidi-platform-rest-api-documentation/v5/overview> (HTTP 200)
- Source of truth: `ushahidi/platform` →
  `src/Ushahidi/Modules/V5/Http/Controllers/PostController.php::store()` and
  `src/Ushahidi/Modules/V5/Actions/Post/Commands/CreatePostCommand::createFromRequest()`.

### Create-post endpoint

```
POST {USHAHIDI_DEPLOYMENT_URL}/api/v5/posts
Authorization: Bearer <access_token>
Content-Type: application/json
```

`store()` runs an authorizer keyed on `form_id` and hands the request to
`CreatePostCommand`. A `201` returns the created `PostResource` (its `id` is the
remote receipt id).

### OAuth2 token flow

```
POST {USHAHIDI_DEPLOYMENT_URL}/oauth/token
Content-Type: application/json
{
  "grant_type": "client_credentials",
  "client_id": "<deployment client id>",
  "client_secret": "<deployment client secret>",
  "scope": "posts forms"
}
```

`client_credentials` is the server-to-server grant a federator uses (no user
context). Deployments may instead require the `password` grant; either way the
adapter only ever receives an already-minted `USHAHIDI_TOKEN` — GeoResponde does
not perform the token exchange itself and never stores credentials.

### Request body shape (what the mapper emits)

The mapper (`mapper.ts`) emits the documented v5 create-post body (research 02
§3a):

```json
{
  "form": { "id": 12 },
  "title": "Missing person - Plaza Ejemplo",
  "content": "Reported missing. Last seen at Plaza Ejemplo. Age: 34.",
  "values": {
    "<field_key>": ["<value>"],
    "<location_key>": [{ "value": { "lat": 10.5, "lon": -66.9 } }]
  }
}
```

`values` is a `fieldKey → array` map. **Form field keys are per-deployment** and
are discovered at integration time via:

```
GET {USHAHIDI_DEPLOYMENT_URL}/api/v5/forms/{id}/attributes
```

### Delta from research 02 §3a (version note)

The current `develop` branch of `ushahidi/platform` reads the create-post fields
**flattened** rather than nested:

- `form_id` (top-level integer) instead of `form: { id }`.
- structured survey answers under **`post_content`** (an array of
  `{ fields: [...] }` stage objects) instead of a flat `values` map.
- extra optional fields: `post_date`, `status` (defaults to `draft`/`published`
  per deployment), `published_to`, `locale`, `base_language`.

GeoResponde emits the **documented `form`/`values` shape** (research 02 §3a),
which the hosted v5 API and its compatibility layer accept and which keeps the
mapper deployment-agnostic. When integrating a specific deployment that only
accepts the flattened `form_id`/`post_content` variant, translate at the
transport edge using that deployment's `forms/{id}/attributes` to build
`post_content`; the pure `Report → { form, title, content, values }` mapping
stays the canonical intermediate.

## Live send guard (no accidental sends)

A real `POST` fires ONLY when ALL of these hold:

1. `submit()` is called with `dryRun === false`, AND
2. `process.env.GEORESPONDE_SUBMIT_LIVE === '1'`, AND
3. `USHAHIDI_DEPLOYMENT_URL` and `USHAHIDI_TOKEN` are set.

Any missing condition falls back to a dry-run preview (or `skipped` when a live
send was explicitly requested but unconfigured). The adapter never logs
`report.fields`, the request body, the cédula, or the token.

## Env vars (live path only)

| Var | Source |
| --- | --- |
| `USHAHIDI_DEPLOYMENT_URL` | Target deployment base URL (e.g. `https://<deployment>`) |
| `USHAHIDI_FORM_ID` | Dashboard → Surveys → the target form id |
| `USHAHIDI_TOKEN` | OAuth2 access token from `POST {deployment}/oauth/token` |
| `GEORESPONDE_SUBMIT_LIVE` | Set to `1` to allow a real POST; unset/`0` keeps dry-run |

No credentials are committed. Dry-run works with none of these set.
