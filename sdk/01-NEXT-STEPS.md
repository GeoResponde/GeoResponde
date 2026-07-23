# Next Steps — From Mock Emitters to Real Sources

This is the bridge between what exists today (`cap_consumer.py`, `hxl_parser.py`,
tested clean against the mock emitters) and pointing either one at a real,
live source. It's staged deliberately — each stage should be fully working
and understood before starting the next one.

## Guiding principle (carried over from the OHI spec)

Everything below stays **read-only**. No automatic catalog writes, no
scheduled polling loop, no database wiring — until the manual/dry-run stage
for a given source has been done and its output inspected by a person. This
mirrors `docs/specifications/open-humanitarian-interface.md` §1: OHI's job
right now is to normalize and demonstrate coverage, not to become a
pipeline. Don't skip ahead of this on the theory that "it already works
against the mock emitter" — the mock emitters are clean by construction;
real sources aren't.

---

## Stage 0 — Where we are (done)

- `cap_emitter.py` / `hxl_emitter.py`: synthetic sources covering the happy
  path plus every tolerant-parsing edge case in spec §8.2.
- `cap_consumer.py` / `hxl_parser.py`: normalize both into OHI records.
- `test_consumers.py`: automated pass/fail check across all 14 profiles.

This proves the *shape* of the normalization logic is sound. It does **not**
prove the mapping tables (`TAG_MAP`, `FIELD_TAG_MAP` in `hxl_parser.py`;
the CAP element paths in `cap_consumer.py`) are complete enough for a real
source — real sources will use tags, fields, and structures the mock
emitters never needed to cover.

---

## Stage 1 — Test scenario: one real source, manual, read-only

The goal here isn't automation. It's answering one question per source:
**does the consumer/parser survive contact with something we didn't write
ourselves, and what breaks?**

### 1a. CAP — pick a source and confirm its actual format first

GDACS is the natural first candidate (it's the source the earlier standards
research already treats as CAP-adjacent), but its [feed reference
page](https://www.gdacs.org/feed_reference.aspx) lists RSS/GeoRSS endpoints,
not an explicit CAP endpoint. Before writing any code against it:

```bash
curl -s https://www.gdacs.org/xml/rss_eq_24h.xml | head -50
```

Look at what actually comes back. If it's plain RSS/GeoRSS rather than
CAP-namespaced XML, `cap_consumer.py` won't apply to it as-is — GDACS would
need its own adapter that maps RSS/GeoRSS fields into the same OHI Incident
Record `cap_consumer.py` produces, rather than being fed through the CAP
consumer directly. That's a legitimate outcome of this test, not a failure —
it tells us whether GDACS is a "CAP source" or a "needs its own translator"
source, which is exactly the kind of thing the OHI spec's ecosystem
comparison table should end up recording.

If a genuine CAP-formatted alert is found (some GDACS documentation
describes CAP as one of its output formats, alongside XML/GeoJSON/KML — but
confirm the exact URL rather than assuming one), run it through the consumer
directly, one alert at a time, no feed/polling loop yet:

```python
from cap_consumer import normalize_cap_alert
import urllib.request

raw = urllib.request.urlopen("https://<confirmed-cap-alert-url>").read()
record, warnings = normalize_cap_alert(raw, source="gdacs")
print(record)
print(warnings)
```

Read every warning by hand. Expect at minimum:
- Element paths that don't match (real CAP producers sometimes omit
  optional elements the mock emitter always included, or nest `<area>` /
  `<geocode>` differently).
- Severity/certainty/urgency values that are valid CAP but weren't in the
  mock profiles (e.g. a real "Unknown" certainty on a preliminary alert).
- Multiple `<info>` blocks per alert (CAP allows repeating `<info>` for
  multi-language alerts) — `cap_consumer.py` currently only reads the
  first one found. This is a known gap, not yet handled.

### 1b. HXL — pick one dataset and confirm its tag set

Browse [data.humdata.org](https://data.humdata.org) for a small, actively
maintained dataset relevant to the Venezuela response work (or any HDX
Signals dataset, which tend to be reliably HXL-tagged). Get its direct CSV
resource URL from the dataset page, then:

```python
from hxl_parser import consume_dataset

records, warnings, untagged = consume_dataset("https://<hdx-resource-url>", source="hdx-example")
print(untagged, len(records), len(warnings))
for w in warnings:
    print(w)
```

Expect real datasets to use tags **not yet in `TAG_MAP`/`FIELD_TAG_MAP`** —
HXL's tag vocabulary is large (`#population`, `#sector`, `#adm1+code`,
`#reached`, and many more). Every one of those will currently surface as an
`unmapped_tag` warning and land in `raw` rather than `metrics` — which is
the correct, safe behavior per spec §8.2, but it also means:

**Stage 1 for HXL is mostly about growing the mapping tables**, not fixing
bugs. Read the `unmapped_tag` warnings, decide which tags matter enough to
promote into `TAG_MAP`/`FIELD_TAG_MAP`, and add them deliberately — don't
add a tag to the mapping table without also deciding its caster (int? str?
date?) and what happens on a bad value, the same way the existing entries do.

### Stage 1 exit criteria

- One real CAP-formatted alert (from GDACS or elsewhere) successfully
  normalized, with every warning it produced read and understood.
- One real HDX dataset successfully parsed, with its `unmapped_tag`
  warnings triaged into "add to mapping table" vs. "not needed yet."
- A short note added to `docs/specifications/ecosystem-comparison.md`
  recording what was actually found (e.g. "GDACS's public feeds are
  RSS/GeoRSS; CAP-specific endpoint TBD/needs an adapter instead").

---

## Stage 2 — Small, scheduled, still read-only

Only after Stage 1 has been done for at least one CAP source and one HXL
source:

- Wrap `consume_feed` / `consume_dataset` in a simple poll loop (a cron job
  or scheduled task is enough — no need for infrastructure yet).
- Log output somewhere durable (a file, or a simple append-only store) —
  still no catalog writes.
- Run it for a few days against real traffic and see what new warning
  types show up that a single manual test didn't catch (feed downtime,
  rate limiting, a malformed alert that isn't the mock emitter's specific
  malformed-xml shape, etc).

## Stage 3 — Catalog integration (out of scope for now)

Only after Stage 2 has run stably. This is where the deferred §4 (Report
Submission) of the OHI spec and the auth strategy in §6 become relevant —
revisit those sections once there's a real need, rather than designing them
speculatively now.

---

## Practical notes

- **Don't expand `TAG_MAP` speculatively.** Add a tag when a real dataset
  in Stage 1 actually uses it and you've decided it matters — not
  preemptively for tags you expect to see someday.
- **The CAP multi-`<info>` gap is real and known.** If the first real CAP
  source you test happens to use multiple `<info>` blocks, that's the first
  actual code change Stage 1 should produce, not a mapping-table tweak.
- **Keep Stage 1 scripts as throwaway/manual, not committed CLI tooling.**
  The point is a human reading output, not an automated pipeline — automating
  too early skips the "did a person actually look at this" step that's the
  whole value of doing this in stages.
