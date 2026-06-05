"""Report photo coverage for 1990s+ players."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODERN = {"1990s", "2000s", "2010s", "2020s"}


def has_photo(photos: dict, slug: str) -> bool:
    entry = photos.get(slug)
    return bool(entry and entry.get("photoUrl"))


def main() -> None:
    advanced = json.loads((ROOT / "data/players_advanced.json").read_text(encoding="utf-8"))
    photos = json.loads((ROOT / "data/player_photos.json").read_text(encoding="utf-8"))
    unmatched_path = ROOT / "data/unmatched_photos.csv"
    unmatched = pd.read_csv(unmatched_path) if unmatched_path.exists() else pd.DataFrame()

    rows = [
        r
        for r in advanced
        if r.get("ws48") is not None or r.get("vorp") is not None or r.get("per") is not None
    ]
    modern_rows = [r for r in rows if r["era"] in MODERN]
    modern_slugs = {r["baseSlug"] for r in modern_rows}
    missing_slugs = {s for s in modern_slugs if not has_photo(photos, s)}

    print("=== 1990s+ photo coverage (game pool) ===")
    print(f"Rows: {len(modern_rows)}")
    print(
        f"Rows missing photo: {sum(1 for r in modern_rows if r['baseSlug'] in missing_slugs)} "
        f"({sum(1 for r in modern_rows if r['baseSlug'] in missing_slugs) / len(modern_rows):.1%})"
    )
    print(f"Unique players (baseSlug): {len(modern_slugs)}")
    print(f"Unique missing: {len(missing_slugs)} ({len(missing_slugs) / len(modern_slugs):.1%})")
    print()

    for label, eras in [("By era (unique baseSlug)", MODERN)]:
        print(label + ":")
        for era in sorted(eras):
            era_slugs = {r["baseSlug"] for r in modern_rows if r["era"] == era}
            era_miss = {s for s in era_slugs if s in missing_slugs}
            pct = len(era_miss) / len(era_slugs) if era_slugs else 0
            print(f"  {era}: {len(era_miss)}/{len(era_slugs)} missing ({pct:.1%})")

    print()
    print("By era (rows):")
    for era in sorted(MODERN):
        era_rows = [r for r in modern_rows if r["era"] == era]
        era_miss = [r for r in era_rows if r["baseSlug"] in missing_slugs]
        pct = len(era_miss) / len(era_rows) if era_rows else 0
        print(f"  {era}: {len(era_miss)}/{len(era_rows)} rows missing ({pct:.1%})")

    if not unmatched.empty:
        um = unmatched[unmatched["baseSlug"].isin(missing_slugs)]
        print()
        print("Unmatched reasons (90s+ only):")
        print(um["reason"].value_counts().to_string())

    print()
    print("All missing 90s+ players:")
    slug_to_name = {}
    slug_to_eras: dict[str, set[str]] = {}
    for r in modern_rows:
        slug_to_name.setdefault(r["baseSlug"], r["player"])
        slug_to_eras.setdefault(r["baseSlug"], set()).add(r["era"])

    reason_by_slug = (
        unmatched.set_index("baseSlug")["reason"].to_dict() if not unmatched.empty else {}
    )
    for slug in sorted(missing_slugs):
        eras = ",".join(sorted(slug_to_eras.get(slug, [])))
        rsn = reason_by_slug.get(slug, "no_photoUrl_in_json")
        print(f"  {slug:32} {slug_to_name[slug]:28} [{eras}]  {rsn}")


if __name__ == "__main__":
    main()
