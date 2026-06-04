"""Join 82-0 player rows with peak-in-decade advanced metrics from BBRef cache."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pandas as pd
import requests

from config import (
    ERA_TO_SEASON_END_YEARS,
    EXCLUDED_ERAS,
    METRIC_COLUMNS,
    PLAYERS_URL,
    TEAM_ALIASES,
)

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "data" / "cache" / "seasons"
OUT_PATH = ROOT / "data" / "players_advanced.json"
UNMATCHED_PATH = ROOT / "data" / "unmatched_rows.csv"


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_players() -> list[dict]:
    resp = requests.get(PLAYERS_URL, timeout=120)
    resp.raise_for_status()
    players = resp.json()
    return [p for p in players if p.get("era") not in EXCLUDED_ERAS]


def load_season_index() -> pd.DataFrame:
    frames = []
    for path in sorted(CACHE_DIR.glob("*.json")):
        year = int(path.stem)
        rows = json.loads(path.read_text(encoding="utf-8"))
        if not rows:
            continue
        df = pd.DataFrame(rows)
        df["season_end_year"] = year
        frames.append(df)
    if not frames:
        raise FileNotFoundError(
            f"No cached seasons in {CACHE_DIR}. Run fetch_bbref_seasons.py first."
        )
    all_df = pd.concat(frames, ignore_index=True)
    all_df["name_key"] = all_df["player"].map(normalize_name)
    all_df["team"] = all_df["team"].astype(str).str.upper()
    return all_df


def peak_in_decade(
    season_df: pd.DataFrame,
    name_key: str,
    team: str,
    season_years: range,
) -> tuple[dict[str, float | None], bool]:
    aliases = TEAM_ALIASES.get(team, {team})
    team_subset = season_df[
        (season_df["name_key"] == name_key)
        & (season_df["season_end_year"].isin(season_years))
        & (season_df["team"].isin(aliases))
    ]
    used_team_strict = not team_subset.empty
    subset = team_subset
    if subset.empty:
        subset = season_df[
            (season_df["name_key"] == name_key)
            & (season_df["season_end_year"].isin(season_years))
        ]

    result: dict[str, float | None] = {}
    for out_key, col in METRIC_COLUMNS.items():
        if col not in subset.columns or subset.empty:
            result[out_key] = None
            continue
        values = subset[col].dropna()
        result[out_key] = float(values.max()) if len(values) else None
    return result, used_team_strict


def enrich(players: list[dict], season_df: pd.DataFrame) -> tuple[list[dict], pd.DataFrame]:
    enriched: list[dict] = []
    unmatched_rows: list[dict] = []

    for row in players:
        era = row["era"]
        season_years = ERA_TO_SEASON_END_YEARS.get(era)
        if season_years is None:
            unmatched_rows.append({**row, "reason": "unknown_era"})
            continue

        name_key = normalize_name(row["player"])
        peaks, team_strict = peak_in_decade(
            season_df, name_key, row["team"], season_years
        )
        has_any = any(peaks[k] is not None for k in METRIC_COLUMNS)

        enriched.append(
            {
                **row,
                **peaks,
                "metrics_source": "basketball-reference",
                "peak_rule": "max_season_in_decade",
                "team_strict": team_strict,
            }
        )
        if not has_any:
            unmatched_rows.append({**row, "reason": "no_bbref_match"})

    return enriched, pd.DataFrame(unmatched_rows)


def main() -> None:
    players = load_players()
    season_df = load_season_index()
    enriched, unmatched = enrich(players, season_df)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(enriched, indent=2), encoding="utf-8")
    unmatched.to_csv(UNMATCHED_PATH, index=False)

    total = len(enriched)
    matched = sum(
        1
        for r in enriched
        if any(r.get(k) is not None for k in METRIC_COLUMNS)
    )
    print(f"Wrote {OUT_PATH} ({total} rows)")
    print(f"Rows with >=1 metric: {matched} ({matched / total:.1%})")
    print(f"Unmatched log: {UNMATCHED_PATH} ({len(unmatched)} rows)")


if __name__ == "__main__":
    main()
