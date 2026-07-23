#!/usr/bin/env python3
"""
HXL Mock Emitter
================
A dependency-free HTTP server that emits synthetic HXL-tagged datasets
(CSV, the primary HXL distribution format), deliberately including both
well-tagged and problematic profiles.

Purpose: give the generic HXL parser (OHI spec, docs/specifications/
open-humanitarian-interface.md, section 8.2) something concrete and
reproducible to test against, without depending on a real HDX dataset
being in a particular state at test time.

Usage:
    python3 hxl_emitter.py [--port 8802]

Endpoints:
    GET /hxl/datasets
        Index (JSON) of all available dataset profiles.

    GET /hxl/dataset/<profile>
        The raw CSV for a single named profile.
        Returns 404 for unknown profile names.

    GET /health
        Plain-text OK, plus the list of available profile names.

Profiles (see PROFILES dict below for exact payloads and rationale):
    fully-tagged        every column has a correct, unambiguous HXL hashtag
    partially-tagged     some columns tagged, some left as plain headers
    no-tags             ordinary CSV, no HXL hashtag row at all
    blank-cells         tagged correctly, but some cells are empty/missing
    mismatched-tag      one column uses a nonstandard/invalid hashtag+attribute
    duplicate-tags      two columns share the exact same hashtag (ambiguous
                        mapping — parser must decide how to resolve or flag it)
"""

import argparse
import csv
import io
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse


def _to_csv(rows):
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()


PROFILES = {
    "fully-tagged": {
        "description": "Every column carries a correct HXL hashtag. Ideal case for the generic parser.",
        "csv": _to_csv([
            ["Location", "Affected", "Injured", "Killed", "Date Reported", "Organization"],
            ["#loc+name", "#affected", "#affected+injured", "#affected+killed", "#date+reported", "#org+name"],
            ["Sucre State", "12000", "340", "18", "2026-07-08", "Cruz Roja Venezolana"],
            ["Mérida State", "4500", "90", "3", "2026-07-08", "Protección Civil"],
        ]),
    },
    "partially-tagged": {
        "description": "Some columns tagged, others left as plain text headers with no hashtag row entry "
                        "(represented here as an empty cell in the tag row).",
        "csv": _to_csv([
            ["Location", "Affected", "Notes", "Date Reported"],
            ["#loc+name", "#affected", "", "#date+reported"],
            ["Sucre State", "12000", "Coordination ongoing with local shelters", "2026-07-08"],
            ["Mérida State", "4500", "", "2026-07-08"],
        ]),
    },
    "no-tags": {
        "description": "Ordinary CSV with no HXL hashtag row whatsoever. Parser must detect the absence "
                        "gracefully and either reject or pass the whole file through as unparsed/raw.",
        "csv": _to_csv([
            ["Location", "Affected", "Injured", "Killed", "Date Reported"],
            ["Sucre State", "12000", "340", "18", "2026-07-08"],
            ["Mérida State", "4500", "90", "3", "2026-07-08"],
        ]),
    },
    "blank-cells": {
        "description": "Correctly tagged, but several data cells are empty — tests handling of missing "
                        "values within an otherwise well-formed dataset (should normalize to null, not 0).",
        "csv": _to_csv([
            ["Location", "Affected", "Injured", "Killed", "Date Reported"],
            ["#loc+name", "#affected", "#affected+injured", "#affected+killed", "#date+reported"],
            ["Sucre State", "12000", "", "18", "2026-07-08"],
            ["Falcón State", "", "", "", "2026-07-08"],
            ["", "3000", "50", "", ""],
        ]),
    },
    "mismatched-tag": {
        "description": "One column uses a hashtag with a nonstandard attribute ('#affected+banana') that "
                        "isn't in any known tag-mapping table — tests best-effort mapping with a logged "
                        "warning rather than a hard failure.",
        "csv": _to_csv([
            ["Location", "Affected", "Weird Column", "Date Reported"],
            ["#loc+name", "#affected", "#affected+banana", "#date+reported"],
            ["Sucre State", "12000", "999", "2026-07-08"],
            ["Mérida State", "4500", "42", "2026-07-08"],
        ]),
    },
    "duplicate-tags": {
        "description": "Two columns share the identical hashtag '#affected+injured', creating an ambiguous "
                        "mapping the parser must resolve (e.g. first-wins, sum, or flag-as-conflict) rather "
                        "than silently overwriting one with the other.",
        "csv": _to_csv([
            ["Location", "Injured (Field Report)", "Injured (Hospital Count)", "Date Reported"],
            ["#loc+name", "#affected+injured", "#affected+injured", "#date+reported"],
            ["Sucre State", "340", "298", "2026-07-08"],
            ["Mérida State", "90", "95", "2026-07-08"],
        ]),
    },
}


def build_index_json():
    import json
    entries = {
        name: {
            "description": v["description"],
            "url": f"/hxl/dataset/{name}",
        }
        for name, v in PROFILES.items()
    }
    return json.dumps({"profiles": entries}, indent=2)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type="text/plain"):
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]

        if parsed.path == "/health":
            names = "\n".join(f"  - {n}: {v['description']}" for n, v in PROFILES.items())
            self._send(200, f"OK\nAvailable profiles:\n{names}")
            return

        if parts == ["hxl", "datasets"]:
            self._send(200, build_index_json(), "application/json")
            return

        if len(parts) == 3 and parts[0] == "hxl" and parts[1] == "dataset":
            profile = parts[2]
            if profile not in PROFILES:
                self._send(404, f"Unknown profile: {profile}")
                return
            self._send(200, PROFILES[profile]["csv"], "text/csv")
            return

        self._send(404, "Not found. Try /health, /hxl/datasets, or /hxl/dataset/<profile>")

    def log_message(self, fmt, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description="HXL Mock Emitter")
    parser.add_argument("--port", type=int, default=8802)
    args = parser.parse_args()

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"HXL mock emitter running on http://localhost:{args.port}")
    print(f"  GET /health")
    print(f"  GET /hxl/datasets")
    print(f"  GET /hxl/dataset/<profile>")
    print(f"Profiles: {', '.join(PROFILES.keys())}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
