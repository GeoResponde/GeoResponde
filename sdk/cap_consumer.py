#!/usr/bin/env python3
"""
Generic CAP Consumer
=====================
Normalizes Common Alerting Protocol (CAP) 1.1/1.2 alerts into OHI Incident
Records (see docs/specifications/open-humanitarian-interface.md, section 2.1).

Design principles (per OHI spec section 8.2):
  - Malformed XML for a single alert -> skip + log, never fail the whole batch.
  - Missing optional fields -> normalize to "unknown"/None, never fabricate.
  - Out-of-enum severity/certainty/urgency values -> fall back to "unknown",
    logged as a warning, never a hard failure.
  - Expired alerts -> still ingested, flagged expired=True, never silently
    dropped (a downstream consumer may still want the history).

No external dependencies -- stdlib only (urllib, xml.etree.ElementTree).

Library usage:
    from cap_consumer import consume_feed

    records, skipped = consume_feed("http://localhost:8801/cap/feed")

CLI usage:
    python3 cap_consumer.py --feed http://localhost:8801/cap/feed
"""

import argparse
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import urljoin

CAP_NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

# CAP 1.2 spec enums. Anything outside these normalizes to "unknown" with a warning.
SEVERITY_ENUM = {"minor", "moderate", "severe", "extreme", "unknown"}
CERTAINTY_ENUM = {"observed", "likely", "possible", "unknown"}
URGENCY_ENUM = {"immediate", "expected", "past", "unknown"}


class ConsumerWarning:
    """A non-fatal issue encountered while normalizing one alert."""

    def __init__(self, code, message):
        self.code = code
        self.message = message

    def to_dict(self):
        return {"code": self.code, "message": self.message}

    def __repr__(self):
        return f"<ConsumerWarning {self.code}: {self.message}>"


def fetch_url(url, timeout=10):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read()


def fetch_feed_entries(feed_url):
    """
    Fetch an Atom-style CAP feed and return a list of (entry_id, absolute_link).
    A malformed *feed index* is treated as fatal (unlike a single malformed
    alert within it) -- if the index itself can't be parsed there is nothing
    to iterate, so this raises ET.ParseError to the caller.
    """
    raw = fetch_url(feed_url)
    root = ET.fromstring(raw)
    entries = []
    for entry in root.findall("atom:entry", ATOM_NS):
        entry_id = entry.findtext("atom:id", default="", namespaces=ATOM_NS)
        link_el = entry.find("atom:link", ATOM_NS)
        href = link_el.get("href") if link_el is not None else None
        if href:
            entries.append((entry_id, urljoin(feed_url, href)))
    return entries


def _text(el, path, default=None):
    if el is None:
        return default
    found = el.findtext(path, default=None, namespaces=CAP_NS)
    return found if found is not None else default


def _normalize_enum(value, enum_set, warnings, field_name):
    if value is None:
        return "unknown"
    normalized = value.strip().lower()
    if normalized not in enum_set:
        warnings.append(ConsumerWarning(
            "enum_fallback",
            f"{field_name}='{value}' is not a recognized value; normalized to 'unknown'",
        ))
        return "unknown"
    return normalized


def _parse_cap_datetime(value):
    """CAP datetimes are ISO 8601 with offset, e.g. 2026-07-08T10:15:00-04:00."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def normalize_cap_alert(xml_bytes, source="cap-unknown", reference_now=None):
    """
    Parse a single CAP alert document.

    Returns (record, warnings). If the XML itself is not well-formed, returns
    (None, warnings) with a single 'malformed_xml' warning -- the caller
    should skip this one alert and continue, per OHI spec 8.2. This function
    never raises for bad *content*.
    """
    warnings = []
    reference_now = reference_now or datetime.now(timezone.utc)

    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        warnings.append(ConsumerWarning("malformed_xml", f"Alert is not well-formed XML: {e}"))
        return None, warnings

    identifier = _text(root, "cap:identifier")
    sent = _text(root, "cap:sent")
    status = _text(root, "cap:status")
    msg_type = _text(root, "cap:msgType")

    info = root.find("cap:info", CAP_NS)
    if info is None:
        warnings.append(ConsumerWarning("missing_info", "Alert has no <info> block; cannot build an incident record"))
        return None, warnings

    category = _text(info, "cap:category", default="Other")
    event = _text(info, "cap:event", default="Unknown event")

    # urgency is not part of the OHI v0.1 core schema (see spec section 2.1),
    # but is carried as a supplementary field since it's cheap to keep and
    # some consumers will want it. Missing/invalid values never fail the record.
    urgency_raw = _text(info, "cap:urgency")
    if urgency_raw is None:
        warnings.append(ConsumerWarning("missing_field", "<urgency> missing; supplementary field set to 'unknown'"))
        urgency = "unknown"
    else:
        urgency = _normalize_enum(urgency_raw, URGENCY_ENUM, warnings, "urgency")

    severity_raw = _text(info, "cap:severity")
    severity = _normalize_enum(severity_raw, SEVERITY_ENUM, warnings, "severity")

    certainty_raw = _text(info, "cap:certainty")
    certainty = _normalize_enum(certainty_raw, CERTAINTY_ENUM, warnings, "certainty")

    effective_raw = _text(info, "cap:effective")
    expires_raw = _text(info, "cap:expires")
    expires_dt = _parse_cap_datetime(expires_raw)

    expired = bool(expires_dt and expires_dt < reference_now)

    headline = _text(info, "cap:headline", default="")
    description = _text(info, "cap:description", default="")

    area = info.find("cap:area", CAP_NS)
    area_desc = _text(area, "cap:areaDesc", default="Unknown area") if area is not None else "Unknown area"
    circle = _text(area, "cap:circle") if area is not None else None
    polygon = _text(area, "cap:polygon") if area is not None else None

    geometry = None
    if circle:
        try:
            coords_part, _radius = circle.split(" ")
            lat_str, lon_str = coords_part.split(",")
            geometry = {"type": "Point", "coordinates": [float(lon_str), float(lat_str)]}
        except (ValueError, IndexError):
            warnings.append(ConsumerWarning("geometry_parse_failed", f"Could not parse <circle> value: '{circle}'"))
    elif polygon:
        # CAP polygons are whitespace-separated "lat,lon" pairs; GeoJSON wants
        # [lon, lat] pairs nested one level deeper under "coordinates".
        try:
            ring = []
            for pair in polygon.split():
                lat_str, lon_str = pair.split(",")
                ring.append([float(lon_str), float(lat_str)])
            geometry = {"type": "Polygon", "coordinates": [ring]}
        except (ValueError, IndexError):
            warnings.append(ConsumerWarning("geometry_parse_failed", f"Could not parse <polygon> value: '{polygon}'"))

    if area is not None and geometry is None and not circle and not polygon:
        warnings.append(ConsumerWarning(
            "no_geometry",
            "Alert has an <area> block but no <circle> or <polygon> found; location will be null, area_desc still available",
        ))

    if not identifier:
        warnings.append(ConsumerWarning("missing_field", "<identifier> missing; record id falls back to 'unknown'"))
    if not effective_raw:
        warnings.append(ConsumerWarning("missing_field", "<effective> missing"))

    record = {
        "id": f"cap:{source}:{identifier or 'unknown'}",
        "source": source,
        "category": (event or category or "other").strip().lower(),
        "severity": severity,
        "certainty": certainty,
        "location": geometry,  # None if no parseable point geometry -- area_desc kept below
        "effective_at": effective_raw,
        "expires_at": expires_raw,
        "expired": expired,
        "description": description or headline,
        # Supplementary fields, outside OHI v0.1 core schema but non-breaking to carry:
        "urgency": urgency,
        "area_desc": area_desc,
        "raw": {
            "identifier": identifier,
            "sent": sent,
            "status": status,
            "msgType": msg_type,
            "headline": headline,
        },
    }

    return record, warnings


def fetch_and_normalize_alert(alert_url, source="cap-mock", reference_now=None):
    raw = fetch_url(alert_url)
    return normalize_cap_alert(raw, source=source, reference_now=reference_now)


def consume_feed(feed_url, source="cap-mock", reference_now=None):
    """
    Fetch a feed and normalize every alert in it.

    Returns (records, skipped):
      - records: successfully normalized Incident Records. Alerts with
        non-fatal issues (missing fields, unknown enum values, expired) are
        included here, with their warnings attached under '_warnings' --
        warnings never exclude a record, only annotate it.
      - skipped: alerts that could not be turned into a record at all
        (e.g. malformed XML, no <info> block), each with its warnings.
    """
    entries = fetch_feed_entries(feed_url)
    records = []
    skipped = []
    for entry_id, link in entries:
        record, warnings = fetch_and_normalize_alert(link, source=source, reference_now=reference_now)
        if record is None:
            skipped.append({
                "entry_id": entry_id,
                "link": link,
                "warnings": [w.to_dict() for w in warnings],
            })
            continue
        record["_warnings"] = [w.to_dict() for w in warnings]
        records.append(record)
    return records, skipped


def main():
    parser = argparse.ArgumentParser(description="Generic CAP Consumer")
    parser.add_argument("--feed", required=True, help="CAP feed URL, e.g. http://localhost:8801/cap/feed")
    parser.add_argument("--source", default="cap-mock", help="Source label to attach to records")
    args = parser.parse_args()

    records, skipped = consume_feed(args.feed, source=args.source)

    print(json.dumps({"records": records, "skipped": skipped}, indent=2))
    print(f"\n{len(records)} record(s) normalized, {len(skipped)} skipped.", file=sys.stderr)


if __name__ == "__main__":
    main()
