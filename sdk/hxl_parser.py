#!/usr/bin/env python3
"""
Generic HXL Parser
==================
Normalizes HXL-tagged CSV datasets into OHI Provider/Report Records (see
docs/specifications/open-humanitarian-interface.md, section 2.2).

Design principles (per OHI spec section 8.2):
  - Untagged columns -> excluded from `metrics`/named fields, kept in `raw`,
    never guessed at.
  - Datasets with no HXL tag row at all -> the whole file is treated as
    untagged; parser does not fabricate a mapping.
  - Unmapped/nonstandard tags (present but not in any known mapping table) ->
    best-effort: logged as a warning, value kept in `raw`, never a hard
    failure for the whole file.
  - Blank cells -> normalized to None, never coerced to 0 or "".
  - Duplicate tags across multiple columns -> first-tagged column wins for
    the normalized field; every value seen (including later duplicates) is
    preserved under raw['tag_conflicts'] with a warning, so nothing silently
    overwrites anything else.

No external dependencies -- stdlib only (csv, urllib).

Library usage:
    from hxl_parser import consume_dataset

    records, warnings, untagged = consume_dataset("http://localhost:8802/hxl/dataset/fully-tagged")

CLI usage:
    python3 hxl_parser.py --url http://localhost:8802/hxl/dataset/fully-tagged
"""

import argparse
import csv
import io
import json
import sys
import urllib.request

# Tags that map into the normalized `metrics` dict, with a value caster.
TAG_MAP = {
    "#affected": ("affected", int),
    "#affected+injured": ("affected_injured", int),
    "#affected+killed": ("affected_killed", int),
}

# Tags that map to top-level record fields rather than into `metrics`.
FIELD_TAG_MAP = {
    "#loc+name": "location_name",
    "#date+reported": "reported_at",
    "#org+name": "provider",
}


class ParserWarning:
    def __init__(self, code, message):
        self.code = code
        self.message = message

    def to_dict(self):
        return {"code": self.code, "message": self.message}

    def __repr__(self):
        return f"<ParserWarning {self.code}: {self.message}>"


def fetch_url(url, timeout=10):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def _looks_like_hxl_tag(value):
    return isinstance(value, str) and value.strip().startswith("#")


def _plan_columns(headers, tag_row, warnings):
    """Decide how each column should be handled, flagging duplicates and unmapped tags as we go."""
    field_targets_seen = {}
    metrics_targets_seen = {}
    column_plan = []

    for idx, header in enumerate(headers):
        tag = (tag_row[idx].strip() if idx < len(tag_row) else "")

        if not tag or not tag.startswith("#"):
            column_plan.append({"idx": idx, "header": header, "kind": "raw_only"})
            continue

        if tag in FIELD_TAG_MAP:
            field_name = FIELD_TAG_MAP[tag]
            if field_name in field_targets_seen:
                prior_header = headers[field_targets_seen[field_name]]
                warnings.append(ParserWarning(
                    "duplicate_tag",
                    f"Tag '{tag}' (column '{header}') duplicates column '{prior_header}' -- "
                    f"first column wins for field '{field_name}', both values preserved under raw.tag_conflicts",
                ))
                column_plan.append({"idx": idx, "header": header, "kind": "field_conflict", "field": field_name})
            else:
                field_targets_seen[field_name] = idx
                column_plan.append({"idx": idx, "header": header, "kind": "field", "field": field_name})
            continue

        if tag in TAG_MAP:
            metrics_field, caster = TAG_MAP[tag]
            if metrics_field in metrics_targets_seen:
                prior_header = headers[metrics_targets_seen[metrics_field]]
                warnings.append(ParserWarning(
                    "duplicate_tag",
                    f"Tag '{tag}' (column '{header}') duplicates column '{prior_header}' -- "
                    f"first column wins for metrics.{metrics_field}, both values preserved under raw.tag_conflicts",
                ))
                column_plan.append({"idx": idx, "header": header, "kind": "metrics_conflict", "field": metrics_field, "caster": caster})
            else:
                metrics_targets_seen[metrics_field] = idx
                column_plan.append({"idx": idx, "header": header, "kind": "metrics", "field": metrics_field, "caster": caster})
            continue

        # Tag present but not in any known mapping table -- best-effort, not a hard failure.
        warnings.append(ParserWarning(
            "unmapped_tag",
            f"Tag '{tag}' (column '{header}') is not in any known tag-mapping table; "
            f"value kept in raw, not included in normalized fields",
        ))
        column_plan.append({"idx": idx, "header": header, "kind": "raw_only", "unmapped_tag": tag})

    return column_plan


def parse_hxl_csv(csv_text, source="hxl-unknown"):
    """
    Parse a HXL-tagged CSV.

    Returns (records, warnings, untagged):
      - records: normalized Provider/Report Record dicts (empty if untagged)
      - warnings: file-level ParserWarnings (duplicate tags, unmapped tags, etc.)
      - untagged: True if no HXL hashtag row was found at all
    """
    warnings = []
    rows = list(csv.reader(io.StringIO(csv_text)))

    if len(rows) < 2:
        warnings.append(ParserWarning("empty_or_malformed", "File has fewer than 2 rows; cannot contain header + tag row"))
        return [], warnings, True

    headers = rows[0]
    tag_row = rows[1]
    data_rows = rows[2:]

    if not any(_looks_like_hxl_tag(t) for t in tag_row):
        warnings.append(ParserWarning(
            "no_hxl_tags",
            "No HXL hashtag row detected; entire file treated as untagged raw data, not parsed into fields",
        ))
        return [], warnings, True

    column_plan = _plan_columns(headers, tag_row, warnings)

    records = []
    for row_idx, row in enumerate(data_rows):
        padded = row + [""] * (len(headers) - len(row))  # tolerate ragged rows

        fields = {}
        metrics = {}
        raw = {}
        tag_conflicts = {}

        for plan in column_plan:
            idx = plan["idx"]
            value = padded[idx].strip() if idx < len(padded) else ""
            value_or_none = value if value != "" else None
            raw[plan["header"]] = value_or_none

            kind = plan["kind"]
            if kind == "field":
                fields[plan["field"]] = value_or_none
            elif kind == "field_conflict":
                tag_conflicts.setdefault(plan["field"], []).append(value_or_none)
            elif kind == "metrics":
                if value_or_none is None:
                    metrics[plan["field"]] = None
                else:
                    try:
                        metrics[plan["field"]] = plan["caster"](value_or_none)
                    except ValueError:
                        metrics[plan["field"]] = None
                        warnings.append(ParserWarning(
                            "cast_failed",
                            f"Row {row_idx}: could not cast '{value_or_none}' for metrics.{plan['field']}; set to null",
                        ))
            elif kind == "metrics_conflict":
                tag_conflicts.setdefault(plan["field"], []).append(value_or_none)
            # raw_only (tagged-but-unmapped, or genuinely untagged): already captured in `raw` above

        record = {
            "id": f"hxl:{source}:{row_idx}",
            "provider": fields.get("provider") or source,
            "incident_ref": None,
            "location_name": fields.get("location_name"),
            "reported_at": fields.get("reported_at"),
            "metrics": metrics,
            "raw": raw,
        }
        if tag_conflicts:
            record["raw"]["tag_conflicts"] = tag_conflicts
        records.append(record)

    return records, warnings, False


def consume_dataset(url, source="hxl-mock"):
    text = fetch_url(url)
    return parse_hxl_csv(text, source=source)


def main():
    parser = argparse.ArgumentParser(description="Generic HXL Parser")
    parser.add_argument("--url", required=True, help="HXL dataset URL, e.g. http://localhost:8802/hxl/dataset/fully-tagged")
    parser.add_argument("--source", default="hxl-mock", help="Source label to attach to records")
    args = parser.parse_args()

    records, warnings, untagged = consume_dataset(args.url, source=args.source)

    print(json.dumps({
        "untagged": untagged,
        "records": records,
        "warnings": [w.to_dict() for w in warnings],
    }, indent=2))
    print(f"\n{len(records)} record(s) normalized, untagged={untagged}, {len(warnings)} warning(s).", file=sys.stderr)


if __name__ == "__main__":
    main()
