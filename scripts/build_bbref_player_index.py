"""Scrape Basketball-Reference A–Z player index → data/bbref_players.json."""
from __future__ import annotations

import json
import re
import time
import unicodedata
from pathlib import Path

from curl_cffi import requests

from config import USER_AGENT

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "bbref_players.json"
LETTERS = "abcdefghijklmnopqrstuvwxyz"
SLEEP_S = 1.5


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def scrape_letter(letter: str) -> list[dict]:
    url = f"https://www.basketball-reference.com/players/{letter}/"
    resp = requests.get(url, impersonate="chrome", timeout=60, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()

    players: list[dict] = []
    seen: set[str] = set()
    for match in re.finditer(
        r'href="(/players/[a-z]/([a-z0-9]+)\.html)"[^>]*>([^<]+)</a>',
        resp.text,
    ):
        bbref_id = match.group(2)
        if bbref_id in seen:
            continue
        seen.add(bbref_id)
        display_name = match.group(3).strip()
        if not display_name or display_name in {"Player", "Rk"}:
            continue
        players.append(
            {
                "bbrefId": bbref_id,
                "player": display_name,
                "name_key": normalize_name(display_name),
                "url": f"https://www.basketball-reference.com{match.group(1)}",
            }
        )
    return players


def main() -> None:
    all_players: list[dict] = []
    by_name_key: dict[str, list[dict]] = {}

    for i, letter in enumerate(LETTERS):
        print(f"  {letter}...", end=" ", flush=True)
        batch = scrape_letter(letter)
        all_players.extend(batch)
        for row in batch:
            by_name_key.setdefault(row["name_key"], []).append(
                {
                    "bbrefId": row["bbrefId"],
                    "player": row["player"],
                    "url": row["url"],
                }
            )
        print(len(batch))
        if i < len(LETTERS) - 1:
            time.sleep(SLEEP_S)

    OUT_PATH.write_text(
        json.dumps(by_name_key, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Wrote {OUT_PATH} ({len(all_players)} players, {len(by_name_key)} name keys)")


if __name__ == "__main__":
    main()
