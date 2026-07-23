#!/usr/bin/env python3
"""
CAP Mock Emitter
================
A dependency-free HTTP server that emits synthetic Common Alerting Protocol
(CAP) 1.2 alerts, deliberately including both well-formed and broken profiles.

Purpose: give the generic CAP consumer (OHI spec, docs/specifications/
open-humanitarian-interface.md, section 8.2) something concrete and
reproducible to test against, without depending on a real feed like GDACS
being in a particular state at test time.

Usage:
    python3 cap_emitter.py [--port 8801]

Endpoints:
    GET /cap/feed
        Index of all available alerts (Atom-like), mirroring how real CAP
        sources (e.g. GDACS) typically distribute: a feed of entries, each
        linking to a full CAP document.

    GET /cap/feed?profile=<name>
        Same feed, filtered to a single profile. Useful for isolating one
        test case.

    GET /cap/alert/<profile>
        The raw CAP 1.2 XML document for a single named profile.
        Returns 404 for unknown profile names.

    GET /health
        Plain-text OK, plus the list of available profile names.

Profiles (see PROFILES dict below for exact payloads and rationale):
    valid-earthquake-severe   well-formed, all fields, Severity=Severe
    valid-flood-moderate      well-formed, different category/severity
    minimal-valid             well-formed, only required fields present
    expired                   well-formed but expires is in the past
    future-effective          well-formed but effective/expires are far future
    missing-required          well-formed XML, but missing <urgency> (required
                               by the OHI Incident Record mapping)
    unknown-severity          well-formed XML, but <severity> value is outside
                               the CAP enum (tests unknown/fallback handling)
    malformed-xml             NOT well-formed XML at all (unclosed tag) —
                               tests that the consumer skips-and-logs rather
                               than crashing the whole batch
"""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from xml.sax.saxutils import escape as xml_escape


def _cap_envelope(identifier, sent, status, msg_type, scope, info_block):
    """Assemble a syntactically well-formed CAP 1.2 alert around an <info> block."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>{identifier}</identifier>
  <sender>mock-emitter@georesponde.example</sender>
  <sent>{sent}</sent>
  <status>{status}</status>
  <msgType>{msg_type}</msgType>
  <scope>{scope}</scope>
  {info_block}
</alert>"""


def _info_block(event, urgency, severity, certainty, effective, expires,
                 headline, description, category="Geo", area_desc="Unknown area",
                 lat=None, lon=None, include_area=True):
    event = xml_escape(event)
    headline = xml_escape(headline)
    description = xml_escape(description)
    category = xml_escape(category)
    area_desc = xml_escape(area_desc)
    urgency_line = f"    <urgency>{urgency}</urgency>\n" if urgency is not None else ""
    area_geo = f"\n      <circle>{lat},{lon} 25.0</circle>" if (lat is not None and lon is not None) else ""
    area_block = (
        f"""    <area>
      <areaDesc>{area_desc}</areaDesc>{area_geo}
    </area>
""" if include_area else ""
    )
    return f"""<info>
    <category>{category}</category>
    <event>{event}</event>
{urgency_line}    <severity>{severity}</severity>
    <certainty>{certainty}</certainty>
    <effective>{effective}</effective>
    <expires>{expires}</expires>
    <headline>{headline}</headline>
    <description>{description}</description>
{area_block}  </info>"""


PROFILES = {
    "valid-earthquake-severe": {
        "description": "Fully well-formed alert, Severity=Severe, Certainty=Observed, point location.",
        "xml": _cap_envelope(
            identifier="mock-cap-eq-000123",
            sent="2026-07-08T10:15:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Earthquake", urgency="Immediate", severity="Severe",
                certainty="Observed", effective="2026-07-08T10:15:00-04:00",
                expires="2026-07-09T10:15:00-04:00",
                headline="M6.2 earthquake detected near Cumana, Venezuela",
                description="A magnitude 6.2 earthquake was detected. Aftershocks possible.",
                category="Geo", area_desc="Sucre State, Venezuela",
                lat="10.4606", lon="-64.1750",
            ),
        ),
    },
    "valid-flood-moderate": {
        "description": "Well-formed alert, different category/severity, no point geometry (area desc only).",
        "xml": _cap_envelope(
            identifier="mock-cap-fl-000456",
            sent="2026-07-08T06:00:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Flood", urgency="Expected", severity="Moderate",
                certainty="Likely", effective="2026-07-08T06:00:00-04:00",
                expires="2026-07-10T06:00:00-04:00",
                headline="River flood warning, Zulia State",
                description="Sustained rainfall expected to raise river levels significantly.",
                category="Met", area_desc="Zulia State, Venezuela",
            ),
        ),
    },
    "minimal-valid": {
        "description": "Well-formed alert with only the fields the OHI Incident Record marks required.",
        "xml": _cap_envelope(
            identifier="mock-cap-min-000789",
            sent="2026-07-08T12:00:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Other", urgency=None, severity="Unknown",
                certainty="Unknown", effective="2026-07-08T12:00:00-04:00",
                expires="2026-07-08T18:00:00-04:00",
                headline="Minimal alert", description="",
                include_area=True, area_desc="Unspecified",
            ),
        ),
    },
    "expired": {
        "description": "Well-formed, but 'expires' is in the past relative to mock 'current time' of 2026-07-08.",
        "xml": _cap_envelope(
            identifier="mock-cap-exp-000111",
            sent="2026-06-01T08:00:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Storm", urgency="Past", severity="Minor",
                certainty="Observed", effective="2026-06-01T08:00:00-04:00",
                expires="2026-06-02T08:00:00-04:00",
                headline="Tropical storm warning (expired)",
                description="This alert's validity window has already passed.",
                category="Met", area_desc="Caribbean coast",
            ),
        ),
    },
    "future-effective": {
        "description": "Well-formed, effective/expires both set far in the future.",
        "xml": _cap_envelope(
            identifier="mock-cap-fut-000222",
            sent="2026-07-08T09:00:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Volcanic Activity", urgency="Future", severity="Moderate",
                certainty="Possible", effective="2027-01-15T00:00:00-04:00",
                expires="2027-02-15T00:00:00-04:00",
                headline="Advisory: possible future volcanic unrest",
                description="Long-range monitoring advisory, not an immediate threat.",
                category="Geo", area_desc="Andes region",
            ),
        ),
    },
    "missing-required": {
        "description": "Well-formed XML, but omits <urgency>, which the OHI mapping treats as required-ish "
                        "(consumer should normalize to 'unknown', not fail the whole alert).",
        "xml": _cap_envelope(
            identifier="mock-cap-missing-000333",
            sent="2026-07-08T11:00:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Landslide", urgency=None, severity="Severe",
                certainty="Observed", effective="2026-07-08T11:00:00-04:00",
                expires="2026-07-09T11:00:00-04:00",
                headline="Landslide reported, missing urgency field",
                description="Deliberately omits <urgency> to test tolerant parsing.",
                category="Geo", area_desc="Mérida State, Venezuela",
            ),
        ),
    },
    "unknown-severity": {
        "description": "Well-formed XML, but <severity> value ('Catastrophic') is outside the CAP enum "
                        "(Minor/Moderate/Severe/Extreme/Unknown) — tests fallback-to-unknown behavior.",
        "xml": _cap_envelope(
            identifier="mock-cap-unkseverity-000444",
            sent="2026-07-08T13:30:00-04:00",
            status="Actual", msg_type="Alert", scope="Public",
            info_block=_info_block(
                event="Earthquake", urgency="Immediate", severity="Catastrophic",
                certainty="Observed", effective="2026-07-08T13:30:00-04:00",
                expires="2026-07-09T13:30:00-04:00",
                headline="Out-of-spec severity value test case",
                description="Severity value here is not a valid CAP enum member on purpose.",
                category="Geo", area_desc="Falcón State, Venezuela",
            ),
        ),
    },
    "malformed-xml": {
        "description": "NOT well-formed XML (unclosed <info> tag). Tests that the consumer skips and logs "
                        "this single entry rather than failing the entire feed batch.",
        "xml": """<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>mock-cap-broken-000555</identifier>
  <sender>mock-emitter@georesponde.example</sender>
  <sent>2026-07-08T14:00:00-04:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Geo</category>
    <event>Earthquake</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Observed</certainty>
    <effective>2026-07-08T14:00:00-04:00</effective>
    <expires>2026-07-09T14:00:00-04:00</expires>
    <headline>Malformed XML test case</headline>
    <description>This document is intentionally missing a closing tag below.
  <area>
      <areaDesc>Test area</areaDesc>
    </area>
</alert>""",
        # Note: <info> and <description> are deliberately never closed above.
    },
}


def build_feed_xml(profile_filter=None):
    names = [p for p in PROFILES if (profile_filter is None or p == profile_filter)]
    entries = "\n".join(
        f"""  <entry>
    <id>{name}</id>
    <title>{xml_escape(PROFILES[name]['description'])}</title>
    <link href="/cap/alert/{name}"/>
  </entry>"""
        for name in names
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>CAP Mock Emitter Feed</title>
  <updated>2026-07-08T00:00:00-04:00</updated>
{entries}
</feed>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type="application/xml"):
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        query = parse_qs(parsed.query)

        if parsed.path == "/health":
            names = "\n".join(f"  - {n}: {v['description']}" for n, v in PROFILES.items())
            self._send(200, f"OK\nAvailable profiles:\n{names}", "text/plain")
            return

        if parts == ["cap", "feed"]:
            profile_filter = query.get("profile", [None])[0]
            if profile_filter and profile_filter not in PROFILES:
                self._send(404, f"Unknown profile: {profile_filter}", "text/plain")
                return
            self._send(200, build_feed_xml(profile_filter), "application/atom+xml")
            return

        if len(parts) == 3 and parts[0] == "cap" and parts[1] == "alert":
            profile = parts[2]
            if profile not in PROFILES:
                self._send(404, f"Unknown profile: {profile}", "text/plain")
                return
            self._send(200, PROFILES[profile]["xml"], "application/xml")
            return

        self._send(404, "Not found. Try /health, /cap/feed, or /cap/alert/<profile>", "text/plain")

    def log_message(self, fmt, *args):
        # Quieter default logging; comment out to get full request logs.
        pass


def main():
    parser = argparse.ArgumentParser(description="CAP Mock Emitter")
    parser.add_argument("--port", type=int, default=8801)
    args = parser.parse_args()

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"CAP mock emitter running on http://localhost:{args.port}")
    print(f"  GET /health")
    print(f"  GET /cap/feed")
    print(f"  GET /cap/feed?profile=<name>")
    print(f"  GET /cap/alert/<name>")
    print(f"Profiles: {', '.join(PROFILES.keys())}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
