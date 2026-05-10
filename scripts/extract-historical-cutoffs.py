#!/usr/bin/env python3
"""Extract CHSAA state qualifier cutoffs from local heat-sheet PDFs.

This is intentionally local-only. It reads PDFs supplied by the coach and
generates a static TypeScript data file used by the cutoff model.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_NAMES: dict[str, str] = {
    "100 Meter Dash": "100m",
    "200 Meter Dash": "200m",
    "400 Meter Dash": "400m",
    "800 Meter Run": "800m",
    "1600 Meter Run": "1600m",
    "3200 Meter Run": "3200m",
    "100 Meter Hurdles": "100m Hurdles",
    "110 Meter Hurdles": "110m Hurdles",
    "300 Meter Hurdles": "300m Hurdles",
    "4x100 Meter Relay": "4x100m Relay",
    "4x200 Meter Relay": "4x200m Relay",
    "4x400 Meter Relay": "4x400m Relay",
    "4x800 Meter Relay": "4x800m Relay",
    "High Jump": "High Jump",
    "Pole Vault": "Pole Vault",
    "Long Jump": "Long Jump",
    "Triple Jump": "Triple Jump",
    "Shot Put": "Shot Put",
    "Discus Throw": "Discus",
}

TIME_EVENTS = {
    "100m",
    "200m",
    "400m",
    "800m",
    "1600m",
    "3200m",
    "100m Hurdles",
    "110m Hurdles",
    "300m Hurdles",
    "4x100m Relay",
    "4x200m Relay",
    "4x400m Relay",
    "4x800m Relay",
}

FIELD_EVENTS = {
    "High Jump",
    "Pole Vault",
    "Long Jump",
    "Triple Jump",
    "Shot Put",
    "Discus",
}

PLAUSIBLE_RANGES: dict[str, tuple[float, float]] = {
    "100m": (9, 20),
    "200m": (19, 35),
    "400m": (42, 80),
    "800m": (105, 190),
    "1600m": (240, 420),
    "3200m": (500, 900),
    "100m Hurdles": (12, 24),
    "110m Hurdles": (12, 24),
    "300m Hurdles": (34, 65),
    "4x100m Relay": (38, 60),
    "4x200m Relay": (82, 130),
    "4x400m Relay": (190, 290),
    "4x800m Relay": (450, 750),
    "High Jump": (48, 90),
    "Pole Vault": (60, 220),
    "Long Jump": (120, 330),
    "Triple Jump": (300, 600),
    "Shot Put": (240, 900),
    "Discus": (600, 2400),
}

DEFAULT_PDFS_BY_CLASSIFICATION = {
    "3A": [
        {
            "year": 2018,
            "classification": "3A",
            "filename": "3a-state-track-qualifiers-2018.pdf",
            "source_name": "2018 3A state qualifier PDF",
            "confidence": 90,
        },
        {
            "year": 2019,
            "classification": "3A",
            "filename": "statetrack-qualifiers-2019.pdf",
            "source_name": "2019 CHSAA state qualifier PDF",
            "confidence": 90,
        },
        {
            "year": 2021,
            "classification": "3A",
            "filename": "2021 State meet heat sheets.pdf",
            "source_name": "2021 CHSAA state heat sheet PDF",
            "confidence": 90,
        },
        {
            "year": 2022,
            "classification": "3A",
            "filename": "heatsheets2022_3a.pdf",
            "source_name": "2022 CHSAA 3A heat sheet",
            "confidence": 95,
        },
        {
            "year": 2023,
            "classification": "3A",
            "filename": "3a_statequallist_2023_v2.pdf",
            "source_name": "2023 CHSAA 3A qualifier list",
            "confidence": 95,
        },
        {
            "year": 2024,
            "classification": "3A",
            "filename": "heatsheets2024_3a.pdf",
            "source_name": "2024 CHSAA 3A heat sheet",
            "confidence": 95,
        },
        {
            "year": 2025,
            "classification": "3A",
            "filename": "HeatSheets_2025_3A.pdf",
            "source_name": "2025 CHSAA 3A heat sheet",
            "confidence": 95,
        },
    ],
    "5A": [
        {
            "year": 2018,
            "classification": "5A",
            "filename": "5a-state-track-qualifiers-2018.pdf",
            "source_name": "2018 5A state qualifier PDF",
            "confidence": 90,
        },
        {
            "year": 2019,
            "classification": "5A",
            "filename": "statetrack-qualifiers-2019.pdf",
            "source_name": "2019 CHSAA state qualifier PDF",
            "confidence": 90,
        },
        {
            "year": 2021,
            "classification": "5A",
            "filename": "2021 State meet heat sheets.pdf",
            "source_name": "2021 CHSAA state heat sheet PDF",
            "confidence": 90,
        },
        {
            "year": 2022,
            "classification": "5A",
            "filename": "heatsheets2022_5a.pdf",
            "source_name": "2022 CHSAA 5A heat sheet",
            "confidence": 95,
        },
        {
            "year": 2023,
            "classification": "5A",
            "filename": "5a_statequallist_2023_v3.pdf",
            "source_name": "2023 CHSAA 5A qualifier list",
            "confidence": 95,
        },
        {
            "year": 2024,
            "classification": "5A",
            "filename": "heatsheets2024_5a.pdf",
            "source_name": "2024 CHSAA 5A heat sheet",
            "confidence": 95,
        },
        {
            "year": 2025,
            "classification": "5A",
            "filename": "HeatSheets_2025_5A.pdf",
            "source_name": "2025 CHSAA 5A heat sheet",
            "confidence": 95,
        },
    ],
}


SUPPORTED_HEADING = re.compile(
    r"(?:Event\s+\d+\s+)?"
    r"(?P<gender>Boys|Girls)\s+"
    r"(?P<name>"
    + "|".join(re.escape(name) for name in EVENT_NAMES)
    + r")\s+"
    r"(?P<class>[12345]A)(?:\s|\(|$)"
)
GENERIC_EVENT_HEADING = re.compile(
    r"(?:Event\s+\d+\s+)?(?P<gender>Boys|Girls)\s+.+?\s+(?P<class>[12345]A)(?:\s|\(|$)"
)
ROW_START = re.compile(r"^(?:_+\s*)?(?P<rank>\d{1,2})\s+")
TIME_MARK = re.compile(r"(?<![\d:])(?:\d+:)?\d{1,2}\.\d{2}(?!\d)")
DISTANCE_MARK = re.compile(r"(?<!\d)\d{1,3}-\d{1,2}(?:\.\d{1,2})?(?!\d)")


def parse_mark(event: str, raw: str) -> float | None:
    raw = raw.strip()
    if event in TIME_EVENTS:
        if ":" in raw:
            minutes, seconds = raw.split(":", 1)
            return int(minutes) * 60 + float(seconds)
        return float(raw)

    match = re.match(r"^(?P<feet>\d+)-(?P<inches>\d+(?:\.\d+)?)$", raw)
    if not match:
        return None
    return int(match.group("feet")) * 12 + float(match.group("inches"))


def is_plausible(event: str, value: float) -> bool:
    low, high = PLAUSIBLE_RANGES[event]
    return low <= value <= high


def extract_lines(page: Any) -> list[str]:
    page_width = page.width
    page_height = page.height
    column_bounds = [(0, page_width / 2 + 10), (page_width / 2 - 10, page_width)]
    lines: list[str] = []

    for x0, x1 in column_bounds:
        words = page.crop((x0, 0, x1, page_height)).extract_words(
            x_tolerance=2,
            y_tolerance=3,
            use_text_flow=False,
            keep_blank_chars=False,
        )
        groups: list[tuple[int, list[dict[str, Any]]]] = []
        for word in words:
            top = round(word["top"])
            for index, (existing_top, group_words) in enumerate(groups):
                if abs(existing_top - top) <= 3:
                    group_words.append(word)
                    groups[index] = (existing_top, group_words)
                    break
            else:
                groups.append((top, [word]))

        for _, group_words in sorted(groups, key=lambda group: group[0]):
            ordered = sorted(group_words, key=lambda word: word["x0"])
            lines.append(" ".join(word["text"] for word in ordered))

    return lines


def extract_pdf_rows(pdf_path: Path, source: dict[str, Any]) -> list[dict[str, Any]]:
    rows: dict[tuple[int, str, str, str], list[tuple[str, float, str]]] = defaultdict(list)
    current: tuple[str, str] | None = None
    classification = source["classification"]

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for line in extract_lines(page):
                heading = SUPPORTED_HEADING.search(line)
                if heading:
                    event = EVENT_NAMES[heading.group("name")]
                    current = (
                        heading.group("gender"),
                        event,
                    ) if heading.group("class") == classification else None
                    continue

                if "Event" in line and GENERIC_EVENT_HEADING.search(line):
                    current = None
                    continue

                if current is None or not ROW_START.search(line):
                    continue

                gender, event = current
                mark_match = None
                if event in TIME_EVENTS:
                    matches = TIME_MARK.findall(line)
                    if matches:
                        mark_match = matches[-1]
                elif event in FIELD_EVENTS:
                    matches = DISTANCE_MARK.findall(line)
                    if matches:
                        mark_match = matches[-1]

                if not mark_match:
                    continue

                value = parse_mark(event, mark_match)
                if value is None or not is_plausible(event, value):
                    continue

                rows[(source["year"], classification, gender, event)].append(
                    (mark_match, value, line)
                )

    extracted: list[dict[str, Any]] = []
    for (year, cls, gender, event), marks in rows.items():
        reverse = event in FIELD_EVENTS
        sorted_marks = sorted(marks, key=lambda item: item[1], reverse=reverse)
        cutoff_index = min(17, len(sorted_marks) - 1)
        raw, value, line = sorted_marks[cutoff_index]
        confidence = source["confidence"]
        notes: list[str] = []

        if len(sorted_marks) < 18:
            confidence = min(confidence, 86)
            notes.append(
                f"PDF text extraction returned {len(sorted_marks)} parsed accepted entries; using weakest parsed mark."
            )
        elif len(sorted_marks) > 22:
            confidence = min(confidence, 88)
            notes.append(
                f"PDF text extraction returned {len(sorted_marks)} plausible entries; using sorted 18th mark."
            )

        extracted.append(
            {
                "year": year,
                "classification": cls,
                "gender": gender,
                "event": event,
                "markRaw": raw,
                "markValue": value,
                "parsedCount": len(sorted_marks),
                "confidence": confidence,
                "sourceName": source["source_name"],
                "notes": " ".join(notes) if notes else None,
                "debugLine": line,
            }
        )

    return extracted


def ts_string(value: str) -> str:
    return json.dumps(value)


def render_typescript(rows: list[dict[str, Any]], classification: str) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[f"{row['gender']}|{row['event']}"].append(row)

    output: list[str] = [
        "import type { EventKey, Gender } from \"@/types/domain\";",
        "",
        "export type HistoricalSeedCutoffRow = {",
        "  year: number;",
        "  markRaw: string;",
        "  confidence?: number;",
        "  sourceName?: string;",
        "  sourceUrl?: string;",
        "  notes?: string;",
        "};",
        "",
        f"export const historical{classification}CutoffMetadata = {{",
        f"  generatedAt: {ts_string(dt.datetime.now(dt.timezone.utc).isoformat())},",
        f"  classification: {ts_string(classification)},",
        f"  source: \"local_chsaa_{classification.lower()}_qualifier_and_heat_sheet_pdfs\",",
        f"  rowCount: {len(rows)},",
        "  notes: \"Generated from coach-supplied local CHSAA qualifier and heat-sheet PDFs. No credentials or cookies used.\",",
        "};",
        "",
        f"export const historical{classification}SeedCutoffs: Partial<Record<`${{Gender}}|${{EventKey}}`, HistoricalSeedCutoffRow[]>> = {{",
    ]

    for key in sorted(grouped):
        output.append(f"  {ts_string(key)}: [")
        for row in sorted(grouped[key], key=lambda item: item["year"]):
            output.append("    {")
            output.append(f"      year: {row['year']},")
            output.append(f"      markRaw: {ts_string(row['markRaw'])},")
            output.append(f"      confidence: {row['confidence']},")
            output.append(f"      sourceName: {ts_string(row['sourceName'])},")
            if row.get("notes"):
                output.append(f"      notes: {ts_string(row['notes'])},")
            output.append("    },")
        output.append("  ],")

    output.append("};")
    output.append("")
    return "\n".join(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf-dir",
        default="/Users/lukerodriguez/Downloads",
        help="Directory containing the local CHSAA qualifier/heat-sheet PDFs.",
    )
    parser.add_argument(
        "--out",
        default="src/lib/data/historical5ACutoffs.generated.ts",
        help="Generated TypeScript output path.",
    )
    parser.add_argument(
        "--classification",
        default="5A",
        choices=sorted(DEFAULT_PDFS_BY_CLASSIFICATION),
        help="CHSAA classification to extract.",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Write output even if a small number of PDF text-layer events cannot be extracted.",
    )
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    sources = DEFAULT_PDFS_BY_CLASSIFICATION[args.classification]
    all_rows: list[dict[str, Any]] = []
    for source in sources:
        pdf_path = pdf_dir / source["filename"]
        if not pdf_path.exists():
            raise FileNotFoundError(f"Missing PDF: {pdf_path}")
        all_rows.extend(extract_pdf_rows(pdf_path, source))

    expected_keys = {
        (source["year"], args.classification, gender, event)
        for source in sources
        for gender in ("Boys", "Girls")
        for event in EVENT_NAMES.values()
        if not (gender == "Boys" and event == "100m Hurdles")
        if not (gender == "Girls" and event == "110m Hurdles")
    }
    found_keys = {
        (row["year"], row["classification"], row["gender"], row["event"])
        for row in all_rows
    }
    missing = sorted(expected_keys - found_keys)
    if missing and not args.allow_missing:
        raise RuntimeError(f"Missing expected extracted events: {missing[:20]}")

    out_path = Path(args.out)
    out_path.write_text(render_typescript(all_rows, args.classification), encoding="utf-8")

    report = out_path.with_suffix(".report.json")
    warning_rows = [
        {
            "year": year,
            "classification": classification,
            "gender": gender,
            "event": event,
            "notes": "Missing from PDF text extraction.",
        }
        for year, classification, gender, event in missing
    ] + [
        {
            "year": row["year"],
            "gender": row["gender"],
            "event": row["event"],
            "markRaw": row["markRaw"],
            "parsedCount": row["parsedCount"],
            "notes": row["notes"],
            "debugLine": row["debugLine"],
        }
        for row in all_rows
        if row.get("notes")
    ]
    report.write_text(
        json.dumps(
            {
                "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "rowCount": len(all_rows),
                "warnings": warning_rows,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {out_path} with {len(all_rows)} cutoff rows")
    print(f"Wrote {report}")


if __name__ == "__main__":
    main()
