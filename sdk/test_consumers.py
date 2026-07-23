#!/usr/bin/env python3
"""
Coverage harness for the generic CAP consumer and generic HXL parser.

Starts both mock emitters as subprocesses, runs each consumer/parser against
every profile they expose, and checks the result against the expected
behavior documented in mock-emitters/README.md. Prints a pass/fail table.

This is a demonstration/acceptance harness, not a formal test suite --
useful right now for proving out coverage before wiring either consumer up
to a real source (GDACS, HDX).

Usage:
    python3 test_consumers.py
"""

import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cap_consumer import fetch_and_normalize_alert, fetch_feed_entries
from hxl_parser import consume_dataset

CAP_PORT = 8801
HXL_PORT = 8802
CAP_BASE = f"http://localhost:{CAP_PORT}"
HXL_BASE = f"http://localhost:{HXL_PORT}"

# Everything -- consumers, parsers, and emitters -- lives flat in this same
# folder (sdk/), so the emitters are just alongside this script.
MOCK_EMITTERS_DIR = Path(__file__).resolve().parent


def wait_for(url, timeout=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


def run_cap_checks():
    print("\n=== CAP Consumer ===")
    entries = fetch_feed_entries(f"{CAP_BASE}/cap/feed")
    by_profile = {entry_id: link for entry_id, link in entries}

    checks = {
        "valid-earthquake-severe": lambda r, w: r and r["severity"] == "severe" and r["location"] is not None,
        "valid-flood-moderate": lambda r, w: r and r["severity"] == "moderate" and r["location"] is None,
        "minimal-valid": lambda r, w: r and r["severity"] == "unknown",
        "expired": lambda r, w: r and r["expired"] is True,
        "future-effective": lambda r, w: r and r["expired"] is False and any(x.code == "enum_fallback" for x in w),
        "missing-required": lambda r, w: r and r["urgency"] == "unknown" and any(x.code == "missing_field" for x in w),
        "unknown-severity": lambda r, w: r and r["severity"] == "unknown" and any(x.code == "enum_fallback" for x in w),
        "malformed-xml": lambda r, w: r is None and any(x.code == "malformed_xml" for x in w),
    }

    results = []
    for profile, check in checks.items():
        link = by_profile.get(profile)
        if not link:
            results.append((profile, "MISSING", "profile not found in feed"))
            continue
        record, warnings = fetch_and_normalize_alert(link, source="cap-mock")
        ok = check(record, warnings)
        results.append((profile, "PASS" if ok else "FAIL", f"{len(warnings)} warning(s)"))

    for profile, status, note in results:
        print(f"  [{status:4}] {profile:28} {note}")
    return all(status == "PASS" for _, status, _ in results)


def run_hxl_checks():
    print("\n=== HXL Parser ===")

    checks = {
        "fully-tagged": lambda recs, w, untagged: (
            not untagged and len(recs) == 2 and recs[0]["metrics"]["affected_injured"] == 340
        ),
        "partially-tagged": lambda recs, w, untagged: (
            not untagged and "Notes" in recs[0]["raw"] and "affected_injured" not in recs[0]["metrics"]
        ),
        "no-tags": lambda recs, w, untagged: untagged is True and len(recs) == 0,
        "blank-cells": lambda recs, w, untagged: (
            not untagged and recs[1]["metrics"]["affected"] is None and recs[1]["metrics"]["affected_injured"] is None
        ),
        "mismatched-tag": lambda recs, w, untagged: (
            not untagged and any(x.code == "unmapped_tag" for x in w)
        ),
        "duplicate-tags": lambda recs, w, untagged: (
            not untagged
            and any(x.code == "duplicate_tag" for x in w)
            and "tag_conflicts" in recs[0]["raw"]
            and recs[0]["metrics"]["affected_injured"] == 340  # first column wins
        ),
    }

    results = []
    for profile, check in checks.items():
        url = f"{HXL_BASE}/hxl/dataset/{profile}"
        records, warnings, untagged = consume_dataset(url, source="hxl-mock")
        ok = check(records, warnings, untagged)
        results.append((profile, "PASS" if ok else "FAIL", f"{len(records)} record(s), {len(warnings)} warning(s)"))

    for profile, status, note in results:
        print(f"  [{status:4}] {profile:20} {note}")
    return all(status == "PASS" for _, status, _ in results)


def main():
    if not MOCK_EMITTERS_DIR.is_dir():
        print(f"ERROR: could not resolve sdk/ directory at expected path:\n  {MOCK_EMITTERS_DIR}")
        print("Expected layout: cap_emitter.py and hxl_emitter.py alongside this script.")
        sys.exit(1)

    cap_proc = subprocess.Popen(
        [sys.executable, "cap_emitter.py", "--port", str(CAP_PORT)],
        cwd=str(MOCK_EMITTERS_DIR), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    hxl_proc = subprocess.Popen(
        [sys.executable, "hxl_emitter.py", "--port", str(HXL_PORT)],
        cwd=str(MOCK_EMITTERS_DIR), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        if not wait_for(f"{CAP_BASE}/health") or not wait_for(f"{HXL_BASE}/health"):
            print("ERROR: mock emitters did not start in time.")
            sys.exit(1)

        cap_ok = run_cap_checks()
        hxl_ok = run_hxl_checks()

        print("\n=== Summary ===")
        print(f"  CAP consumer:  {'ALL PASS' if cap_ok else 'FAILURES PRESENT'}")
        print(f"  HXL parser:    {'ALL PASS' if hxl_ok else 'FAILURES PRESENT'}")
        sys.exit(0 if (cap_ok and hxl_ok) else 1)
    finally:
        cap_proc.terminate()
        hxl_proc.terminate()


if __name__ == "__main__":
    main()
