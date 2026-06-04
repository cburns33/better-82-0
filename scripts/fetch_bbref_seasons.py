"""Download Basketball-Reference advanced season tables (1974–present)."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup, Comment
from curl_cffi import requests

from config import FIRST_ADVANCED_SEASON_END, USER_AGENT

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "data" / "cache" / "seasons"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SLEEP_SECONDS = 3.5
TABLE_ID = "advanced"


def season_url(season_end_year: int) -> str:
    return f"https://www.basketball-reference.com/leagues/NBA_{season_end_year}_advanced.html"


def parse_advanced_table(html: str) -> pd.DataFrame:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id=TABLE_ID)
    if table is None:
        # BBRef sometimes nests tables in HTML comments.
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            if TABLE_ID in comment:
                table = BeautifulSoup(comment, "html.parser").find("table", id=TABLE_ID)
                if table:
                    break
    if table is None:
        raise ValueError(f"{TABLE_ID} table not found")

    rows = []
    for tr in table.find("tbody").find_all("tr"):
        if tr.get("class") and "thead" in tr.get("class", []):
            continue
        cells = tr.find_all(["th", "td"])
        if not cells:
            continue
        name = None
        row: dict = {}
        for cell in cells:
            stat = cell.get("data-stat")
            if stat == "name_display":
                name = cell.get_text(strip=True)
                row["player"] = name
            elif stat and stat != "ranker":
                row[stat] = cell.get_text(strip=True)
        if not name or name in {"Rk", "Player"}:
            continue
        rows.append(row)

    if not rows:
        raise ValueError("no player rows parsed")

    df = pd.DataFrame(rows)
    numeric_cols = ["per", "ws_per_48", "obpm", "dbpm", "bpm", "vorp", "g", "mp"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "team_name_abbr" in df.columns:
        df = df.rename(columns={"team_name_abbr": "team"})
    if "team" not in df.columns:
        raise ValueError("team column missing from parsed table")
    df = df[df["team"].notna() & (df["team"] != "TOT")].copy()
    df["season_end_year"] = None
    return df


def fetch_season(season_end_year: int, force: bool = False) -> pd.DataFrame:
    cache_path = CACHE_DIR / f"{season_end_year}.json"
    if cache_path.exists() and not force:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
        return pd.DataFrame(payload)

    url = season_url(season_end_year)
    resp = requests.get(url, impersonate="chrome", timeout=60)
    resp.raise_for_status()
    df = parse_advanced_table(resp.text)
    df["season_end_year"] = season_end_year
    records = df.to_dict(orient="records")
    cache_path.write_text(json.dumps(records), encoding="utf-8")
    time.sleep(SLEEP_SECONDS)
    return df


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=FIRST_ADVANCED_SEASON_END)
    parser.add_argument("--to-year", type=int, default=2026)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    for year in range(args.from_year, args.to_year + 1):
        out = CACHE_DIR / f"{year}.json"
        if out.exists() and not args.force:
            print(f"skip {year} (cached)")
            continue
        print(f"fetch {year}...")
        try:
            fetch_season(year, force=args.force)
            print(f"  ok -> {out}")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED {year}: {exc}")


if __name__ == "__main__":
    main()
