# sdk/ — OHI Generic Consumers, Parsers, and Mock Emitters

Everything needed to normalize CAP alerts and HXL-tagged datasets into OHI
records (see `docs/specifications/open-humanitarian-interface.md`), plus
synthetic sources to test against without depending on a live feed.

All files are dependency-free — Python standard library only.

## Files

| File | Role |
|---|---|
| `cap_emitter.py` | Synthetic CAP 1.2 alert server — 8 profiles, happy path + every tolerant-parsing edge case |
| `hxl_emitter.py` | Synthetic HXL-tagged CSV server — 6 profiles, same purpose |
| `cap_consumer.py` | Generic CAP → OHI Incident Record normalizer |
| `hxl_parser.py` | Generic HXL → OHI Provider/Report Record normalizer |
| `test_consumers.py` | Coverage harness — runs both emitters, both consumers, checks expected behavior, prints pass/fail |

## Running the coverage harness

```bash
python3 test_consumers.py
```

This starts both emitters as subprocesses on ports 8801 (CAP) and 8802 (HXL),
runs every profile through the matching consumer/parser, and asserts the
behavior documented below. Exit code is 0 only if everything passes.

## Running the emitters standalone

```bash
python3 cap_emitter.py --port 8801
python3 hxl_emitter.py --port 8802
```

See `/health` on either for a live list of profiles.

## Using the consumer/parser as libraries

```python
from cap_consumer import consume_feed
records, skipped = consume_feed("http://localhost:8801/cap/feed")

from hxl_parser import consume_dataset
records, warnings, untagged = consume_dataset("http://localhost:8802/hxl/dataset/fully-tagged")
```

## CAP profiles and expected behavior

| Profile | Tests |
|---|---|
| `valid-earthquake-severe` | Happy path — all fields, point geometry |
| `valid-flood-moderate` | Happy path — different category, no point geometry |
| `minimal-valid` | Only OHI-required fields present |
| `expired` | `expires` in the past — must still ingest, flagged `expired: true`, not dropped |
| `future-effective` | Far-future dates; also carries an out-of-enum `urgency` value ("Future" isn't valid CAP) |
| `missing-required` | Missing `<urgency>` — normalizes to `unknown`, doesn't fail the alert |
| `unknown-severity` | `<severity>` outside the CAP enum — falls back to `unknown` |
| `malformed-xml` | Not well-formed XML — skipped and logged, doesn't fail the whole feed batch |

## HXL profiles and expected behavior

| Profile | Tests |
|---|---|
| `fully-tagged` | Happy path — every column correctly tagged |
| `partially-tagged` | Untagged columns land in `raw`, not guessed at |
| `no-tags` | No hashtag row at all — detected and treated as untagged, not parsed |
| `blank-cells` | Missing values normalize to `null`, not `0` |
| `mismatched-tag` | Unrecognized hashtag — logged as a warning, kept in `raw`, not a hard failure |
| `duplicate-tags` | Two columns share a hashtag — first wins, both values preserved under `raw.tag_conflicts` |

## Notes / open decisions carried over from the OHI spec draft

- `urgency` is not part of the OHI v0.1 core schema (spec §2.1) but is carried
  as a supplementary field on CAP-derived records since it was cheap to keep.
  Worth deciding whether to formalize it into the schema or drop it.
- Duplicate-tag resolution in the HXL parser is "first column wins." This is
  an implementation choice, not a spec decision (see spec §10) — confirm
  before pointing the parser at real HDX data with unpredictable column order.
