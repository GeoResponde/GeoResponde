# Stage 1 Milestone — CAP Consumer vs. Real Source (NWS)

* **Status:** Stage 1 exit criteria met for CAP (see `01-NEXT-STEPS.md`).
* **Source used:** NWS / `api.weather.gov` — genuine CAP 1.2, no adapter needed.
* **Result:** One real alert normalized clean; one real bug found and fixed. 

---

## Commands to reproduce this

### 1. List active alerts for an area (GeoJSON index — always GeoJSON, ignores `Accept`)

```bash
curl -s "https://api.weather.gov/alerts/active?area=MO" \
  -H "User-Agent: georesponde-ohi-test (your-email@example.com)"
```

Grab any alert's `properties.id` (or the top-level `id`, same value) from the response — it looks like:

```
urn:oid:2.49.0.1.840.0.0d51d2f90e3b057bdce735e6382fe45c8973000e.001.1
```

### 2. Fetch that one alert as genuine CAP 1.2 XML

Content negotiation only works on the **per-alert** endpoint, not the collection above — this is worth remembering, it tripped us up on the first attempt.

```bash
curl -s "https://api.weather.gov/alerts/<paste-id-here>" \
  -H "User-Agent: georesponde-ohi-test (your-email@example.com)" \
  -H "Accept: application/cap+xml"
```

**Provided example:**

```bash
curl -s "https://api.weather.gov/alerts/oid:2.49.0.1.840.0.5daaa4052b07e961c78b27b29082c65b84d36a29.001.1" \
  -H "User-Agent: georesponde-ohi-test (your-email@example.com)" \
  -H "Accept: application/cap+xml"
```

Save the output to a file:

```bash
curl -s "https://api.weather.gov/alerts/oid:2.49.0.1.840.0.5daaa4052b07e961c78b27b29082c65b84d36a29.001.1" \
  -H "User-Agent: georesponde-ohi-test (your-email@example.com)" \
  -H "Accept: application/cap+xml" \
  > nws_alert.xml
```

### 3. Run it through the generic CAP consumer

```bash
python -c "
from cap_consumer import normalize_cap_alert
import json

with open('nws_alert.xml', 'rb') as f:
    raw = f.read()

record, warnings = normalize_cap_alert(raw, source='nws')
print(json.dumps(record, indent=2))
for w in warnings:
    print('-', w.to_dict())
"
```

Run from inside `sdk/` (or wherever `cap_consumer.py` lives) so the import resolves.

### 4. Confirm nothing else broke

```bash
python test_consumers.py
```

Always run this after any change to `cap_consumer.py` — it's the regression check against all 8 mock CAP profiles.

---

## Insights Gained

1. **GDACS is not a usable CAP source as-is.** Its advertised `<gdacs:cap>` per-event link 404'd on two different events. Its real, documented API (`gdacsapi/api/events/geteventdata`) returns rich structured data, but in GDACS's own JSON schema — not CAP. A GDACS source needs its own adapter, not `cap_consumer.py`. Documented as a finding, not a blocker.

2. **NWS (`api.weather.gov`) is a genuine, reliable CAP 1.2 source.** Well documented, requires only a `User-Agent` header (no auth), and serves real OASIS CAP 1.2 XML via content negotiation — but only on the per-alert endpoint, not the collection/list endpoint (which always returns GeoJSON regardless of `Accept`).

3. **The real alert normalized cleanly.** Severity, certainty, and urgency all matched the CAP enum exactly — zero enum-fallback warnings. Real NWS data is well-formed and spec-compliant, at least for this sample.

4. **Found and fixed a real, silent bug.** The consumer only ever parsed `<circle>` for geometry. This alert used `<polygon>` (the more common shape for real weather alerts), which was silently dropped — `location` came back `null` with **no warning at all**. Fixed by:
   - Adding `<polygon>` parsing, converting CAP's `lat,lon` pairs to GeoJSON's `[lon, lat]` order.
   - Adding a new `no_geometry` warning whenever an `<area>` block exists but neither `<circle>` nor `<polygon>` could be extracted, so this never fails silently again.

5. **Known, deferred gap:** CAP's `<references>` element (used when an alert updates/supersedes a prior one) appeared in a second real alert pulled during this test but is not yet handled by the consumer. Not fixed in this pass — flagged for a future session, since it wasn't blocking normalization of the alert itself.

6. **Fix verified safe.** Full mock-emitter regression suite still passes 14/14 after the change. Two profiles now report one additional warning each (`valid-flood-moderate`, `minimal-valid`) — both are correctly-detected `no_geometry` cases that were previously silent, not new failures.

---

## Stage 1 Exit Criteria — CAP (from `01-NEXT-STEPS.md`)

- [x] One real CAP-formatted alert successfully normalized, every warning read and understood.
- [x] Note added covering what was actually found (this file; also worth a short addition to `docs/specifications/ecosystem-comparison.md` under CAP/GDACS).

## Not yet done (carried forward, not blocking)

- `<references>` / alert-update-chain handling.
- HXL Stage 1 (real HDX dataset) — CAP and HXL were tracked as parallel, independent Stage 1 tasks; this milestone only closes out CAP.
