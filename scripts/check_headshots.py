"""Quick audit of headshot URL availability."""
from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = json.loads((ROOT / "data" / "player_photos.json").read_text(encoding="utf-8"))
ADVANCED = json.loads((ROOT / "data" / "players_advanced.json").read_text(encoding="utf-8"))

slug_era: dict[str, str] = {}
for row in ADVANCED:
    slug_era.setdefault(row["baseSlug"], row["era"])

NBA_URL = "https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png"
DB_URL = (
    "https://bvwahamwfvolchcezxnw.supabase.co/storage/v1/object/public/nba_photos/{id}.webp"
)
AK_URL = (
    "https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{id}.png"
)

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (compatible; 82-0-metrics/1.0)"


def probe(url: str) -> tuple[int, int]:
    try:
        resp = session.get(url, timeout=15)
        return resp.status_code, len(resp.content) if resp.ok else 0
    except requests.RequestException:
        return 0, 0


def main() -> None:
    by_era: dict[str, list[int]] = defaultdict(list)
    for slug, entry in PHOTOS.items():
        by_era[slug_era.get(slug, "?")].append(entry["nbaId"])

    print("Era sample (40 ids): nba_ok / db_ok / ak_ok")
    for era in sorted(by_era):
        sample = by_era[era]
        if len(sample) > 40:
            sample = random.sample(sample, 40)
        nba = db = ak = 0
        for nba_id in sample:
            s, n = probe(NBA_URL.format(id=nba_id))
            if s == 200 and n > 1000:
                nba += 1
            s, n = probe(DB_URL.format(id=nba_id))
            if s == 200 and n > 500:
                db += 1
            s, n = probe(AK_URL.format(id=nba_id))
            if s == 200 and n > 1000:
                ak += 1
        print(f"  {era}: {nba}/{len(sample)}  {db}/{len(sample)}  {ak}/{len(sample)}")

    # ambiguous names cliff robinson
    for slug in ("cliff_robinson", "charles_davis", "dan_anderson"):
        if slug in PHOTOS:
            e = PHOTOS[slug]
            print(f"\n{slug} -> {e['player']} id={e['nbaId']}")


if __name__ == "__main__":
    main()
