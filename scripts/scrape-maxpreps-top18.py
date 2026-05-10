#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

from lxml import html as lxml_html
import subprocess


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


MAXPREPS_EVENT_NAMES: Dict[str, str] = {
    "100 Meter": "100m",
    "200 Meter": "200m",
    "400 Meter": "400m",
    "800 Meter": "800m",
    "1600 Meter": "1600m",
    "3200 Meter": "3200m",
    "100 Meter Hurdles": "100m Hurdles",
    "110 Meter Hurdles": "110m Hurdles",
    "300 Meter Hurdles": "300m Hurdles",
    "4 x 100 Meter": "4x100m Relay",
    "4 x 200 Meter": "4x200m Relay",
    "4 x 400 Meter": "4x400m Relay",
    "4 x 800 Meter": "4x800m Relay",
    "Long Jump": "Long Jump",
    "Triple Jump": "Triple Jump",
    "High Jump": "High Jump",
    "Pole Vault": "Pole Vault",
    "Shot Put": "Shot Put",
    "Discus": "Discus",
}

WIND_SENSITIVE_EVENTS = {
    "100m",
    "200m",
    "100m Hurdles",
    "110m Hurdles",
    "Long Jump",
    "Triple Jump",
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def parse_mmddyyyy(raw: str) -> str:
    raw = clean(raw)
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if not match:
        return "2026-01-01"
    month, day, year = match.group(1), match.group(2), match.group(3)
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def normalize_time_mark(raw: str) -> str:
    raw = clean(raw).lstrip("0") if ":" in raw else clean(raw)
    parts = raw.split(":")
    if len(parts) == 1:
        return raw
    minutes = int(parts[0]) if parts[0].isdigit() else 0
    seconds = ":".join(parts[1:])
    if minutes == 0:
        return re.sub(r"^0+(?=\d)", "", seconds)
    return f"{minutes}:{seconds.zfill(5)}"


def normalize_field_mark(raw: str) -> str:
    raw = clean(raw)
    feet_inches = re.match(r"^(\d+)'\s*(\d+(?:\.\d+)?)\"?$", raw)
    if feet_inches:
        return f"{feet_inches.group(1)}-{feet_inches.group(2)}"
    return raw.replace("'", "-").replace('"', "")


def normalize_mark(event: str, raw: str) -> str:
    event_key = event
    # Treat relays and races as time; everything else as field.
    is_time = event_key.endswith("m") or "Relay" in event_key or "Hurdles" in event_key
    return normalize_time_mark(raw) if is_time else normalize_field_mark(raw)

def strip_location(team_text: str) -> str:
    value = clean(team_text)
    value = re.sub(r"\s*\([^)]*\)\s*$", "", value)
    return clean(value)

def relay_school_from_name(raw_name: str) -> str:
    value = strip_location(raw_name)
    value = re.sub(r"\s+relay team\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+relay\s*$", "", value, flags=re.IGNORECASE)
    return clean(value)


def wind_status(event: str, wind: Optional[float]) -> Tuple[str, Optional[str]]:
    if event not in WIND_SENSITIVE_EVENTS:
        return "verified", None
    if wind is None:
        return "needs_review", "Wind reading missing on MaxPreps row."
    if abs(wind) > 2.0:
        return "needs_review", f"Wind reading {wind:+.1f} exceeds legal limit (+/-2.0)."
    return "verified", None


def make_url(seed_url: str, event_id: str, page: int = 1) -> str:
    from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

    parsed = urlparse(seed_url)
    params = dict(parse_qsl(parsed.query))
    params["eventid"] = event_id
    if page > 1:
        params["page"] = str(page)
    else:
        params.pop("page", None)
    return urlunparse(parsed._replace(query=urlencode(params)))


@dataclass(frozen=True)
class Row:
    source: str
    classification: str
    gender: str
    event: str
    rank: int
    markRaw: str
    athleteName: str
    school: str
    meetName: str
    meetDate: str
    wind: Optional[float]
    sourceUrl: str
    verificationStatus: str
    notes: Optional[str]


def fetch_html(url: str, timeout_s: float) -> str:
    # Use curl to avoid Python SSL store issues in some sandboxed environments.
    cmd = [
        "curl",
        "-sS",
        "-L",
        "--max-time",
        str(int(timeout_s)),
        "-H",
        f"User-Agent: {USER_AGENT}",
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        url,
    ]
    try:
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip()
        raise RuntimeError(f"curl failed for {url}: {stderr}") from e


def event_id_options(seed_html: str, gender: str) -> List[Tuple[str, str, str]]:
    # MaxPreps often renders the <select> markup in a way that HTML parsers
    # don't reliably attach <option> nodes under the <select>. Extract options
    # from the raw HTML instead.
    options: List[Tuple[str, str, str]] = []
    select_match = re.search(
        r'<select[^>]+id="ctl00_ContentBottom_ctl00_cmbEventType"[^>]*>(?P<body>[\s\S]*?)</select>',
        seed_html,
        flags=re.IGNORECASE,
    )
    if not select_match:
        return options

    body = select_match.group("body")
    for match in re.finditer(
        r'<option[^>]*value="(?P<value>[^"]+)"[^>]*>(?P<label>[^<]+)</option>',
        body,
        flags=re.IGNORECASE,
    ):
        label = clean(match.group("label"))
        event = MAXPREPS_EVENT_NAMES.get(label)
        event_id = match.group("value")
        if not event or not event_id:
            continue
        if gender == "Boys" and event == "100m Hurdles":
            continue
        if gender == "Girls" and event == "110m Hurdles":
            continue
        options.append((event, event_id, label))

    return options


def parse_leaderboard_page(
    html_text: str, *, gender: str, event: str, source_url: str, classification: str
) -> List[Row]:
    doc = lxml_html.fromstring(html_text)
    out: List[Row] = []

    for tr in doc.xpath("//table[@id='leaders']//tbody//tr"):
        def one_text(xpath_expr: str) -> str:
            nodes = tr.xpath(xpath_expr)
            if not nodes:
                return ""
            node = nodes[0]
            if isinstance(node, str):
                return clean(node)
            return clean("".join(node.itertext()))

        rank_raw = one_text(".//td[contains(concat(' ', normalize-space(@class), ' '), ' rank ')]")
        try:
            rank = int(rank_raw)
        except Exception:
            continue

        raw_name = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' name ')]//a[not(contains(concat(' ', normalize-space(@class), ' '), ' team '))][1]"
        )
        team_text = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' name ')]//a[contains(concat(' ', normalize-space(@class), ' '), ' team ')][1]"
        )
        meet_name = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' event ')]//a[1]"
        )
        date_text = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' event ')]//*[contains(concat(' ', normalize-space(@class), ' '), ' event-date ')][1]"
        )
        raw_mark = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' result ')]"
        )
        wind_raw = one_text(
            ".//td[contains(concat(' ', normalize-space(@class), ' '), ' wind ')]"
        )

        if not raw_name or not raw_mark:
            continue

        relay = "Relay" in event
        if relay:
            school = strip_location(team_text) if team_text else relay_school_from_name(raw_name)
            athlete_name = f"{school} Relay"
        else:
            school = strip_location(team_text) if team_text else strip_location(raw_name)
            athlete_name = raw_name
        mark_raw = normalize_mark(event, raw_mark)
        wind: Optional[float] = None
        if wind_raw:
            try:
                wind_value = float(wind_raw)
                wind = int(wind_value) if wind_value.is_integer() else wind_value
            except Exception:
                wind = None

        status, note = wind_status(event, wind)

        out.append(
            Row(
                source="maxpreps",
                classification=classification,
                gender=gender,
                event=event,
                rank=rank,
                markRaw=mark_raw,
                athleteName=athlete_name,
                school=school,
                meetName=meet_name or f"MaxPreps {classification} Leaderboard",
                meetDate=parse_mmddyyyy(date_text),
                wind=wind,
                sourceUrl=source_url,
                verificationStatus=status,
                notes=note,
            )
        )

    return out


def load_previous_rows(path: str) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        return payload.get("rows", []) if isinstance(payload, dict) else []
    except FileNotFoundError:
        return []


def diff_top18(
    prev_rows: List[Dict[str, Any]], new_rows: List[Row]
) -> Dict[str, Any]:
    prev_by_key: Dict[Tuple[str, str, int], Dict[str, Any]] = {}
    for row in prev_rows:
        key = (row.get("gender"), row.get("event"), int(row.get("rank", 0) or 0))
        prev_by_key[key] = row

    changes: List[Dict[str, Any]] = []
    for row in new_rows:
        key = (row.gender, row.event, row.rank)
        prev = prev_by_key.get(key)
        if not prev:
            changes.append({"kind": "new_rank_row", "key": key, "row": asdict(row)})
            continue
        fields = ["athleteName", "school", "markRaw", "meetName", "meetDate", "wind"]
        diffs = {f: {"prev": prev.get(f), "next": getattr(row, f)} for f in fields if prev.get(f) != getattr(row, f)}
        if diffs:
            changes.append({"kind": "changed_rank_row", "key": key, "diff": diffs})

    def cutoff(rows: List[Row], gender: str, event: str) -> Optional[str]:
        subset = [r for r in rows if r.gender == gender and r.event == event]
        subset.sort(key=lambda r: r.rank)
        if len(subset) < 18:
            return None
        return subset[17].markRaw

    cutoffs: Dict[str, Any] = {}
    for gender in ("Boys", "Girls"):
        for event in sorted({r.event for r in new_rows}):
            cutoffs[f"{gender}|{event}"] = cutoff(new_rows, gender, event)

    return {"changes": changes, "cutoffs": cutoffs}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classification", required=True, choices=["3A", "4A", "5A"])
    parser.add_argument("--boys-seed-url", required=True)
    parser.add_argument("--girls-seed-url", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--prev", required=False)
    parser.add_argument("--timeout-seconds", type=float, default=15.0)
    parser.add_argument("--sleep-ms", type=int, default=0)
    args = parser.parse_args()

    rows: List[Row] = []
    errors: List[str] = []

    for gender, seed_url in (("Boys", args.boys_seed_url), ("Girls", args.girls_seed_url)):
        try:
            seed_html = fetch_html(seed_url, args.timeout_seconds)
        except Exception as e:
            errors.append(f"{gender} seed: {e}")
            continue

        options = event_id_options(seed_html, gender)
        for event, event_id, _label in options:
            source_url = make_url(seed_url, event_id, 1)
            try:
                html_text = seed_html if (event == "100m") else fetch_html(source_url, args.timeout_seconds)
                rows.extend(
                    parse_leaderboard_page(
                        html_text,
                        gender=gender,
                        event=event,
                        source_url=source_url,
                        classification=args.classification,
                    )
                )
            except Exception as e:
                errors.append(f"{gender} {event}: {e}")

            if args.sleep_ms:
                time.sleep(args.sleep_ms / 1000.0)

    # keep only top-18 unique ranks per event/gender
    dedup: Dict[Tuple[str, str, int], Row] = {}
    for row in rows:
        if row.rank < 1 or row.rank > 18:
            continue
        key = (row.gender, row.event, row.rank)
        dedup.setdefault(key, row)

    final_rows = sorted(dedup.values(), key=lambda r: (r.gender, r.event, r.rank))
    payload: Dict[str, Any] = {
        "scrapedAt": dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc).isoformat(),
        "source": f"maxpreps_public_{args.classification.lower()}_leaderboards_top18",
        "rowCount": len(final_rows),
        "errors": errors,
        "rows": [asdict(r) for r in final_rows],
    }

    prev_rows: List[Dict[str, Any]] = load_previous_rows(args.prev) if args.prev else []
    report = diff_top18(prev_rows, final_rows) if prev_rows else {"changes": [], "cutoffs": {}}
    payload["top18Diff"] = report

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=False)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
