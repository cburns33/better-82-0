"""Map baseSlug values to headshots; download to web/public/img/headshots/."""
from __future__ import annotations

import hashlib
import json
import re
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment
from curl_cffi import requests as cffi_requests
from nba_api.stats.static import players as nba_players

from config import ERA_TO_SEASON_END_YEARS, TEAM_ALIASES, USER_AGENT

ROOT = Path(__file__).resolve().parents[1]
PLAYERS_PATH = ROOT / "data" / "players_advanced.json"
OUT_PATH = ROOT / "data" / "player_photos.json"
BBREF_INDEX_PATH = ROOT / "data" / "bbref_players.json"
OVERRIDES_PATH = ROOT / "data" / "photo_overrides.json"
UNMATCHED_PATH = ROOT / "data" / "unmatched_photos.csv"
LOGO_DIR = ROOT / "web" / "public" / "img" / "team-logos"
HEADSHOT_DIR = ROOT / "web" / "public" / "img" / "headshots"
BBREF_HTML_CACHE = ROOT / "data" / "cache" / "bbref_season_html"

TEAM_NBA_IDS: dict[str, int] = {
    "ATL": 1610612737,
    "BOS": 1610612738,
    "BKN": 1610612751,
    "CHA": 1610612766,
    "CHI": 1610612741,
    "CLE": 1610612739,
    "DAL": 1610612742,
    "DEN": 1610612743,
    "DET": 1610612765,
    "GSW": 1610612744,
    "HOU": 1610612745,
    "IND": 1610612754,
    "LAC": 1610612746,
    "LAL": 1610612747,
    "MEM": 1610612763,
    "MIA": 1610612748,
    "MIL": 1610612749,
    "MIN": 1610612750,
    "NOP": 1610612740,
    "NYK": 1610612752,
    "OKC": 1610612760,
    "ORL": 1610612753,
    "PHI": 1610612755,
    "PHX": 1610612756,
    "POR": 1610612757,
    "SAC": 1610612758,
    "SAS": 1610612759,
    "TOR": 1610612761,
    "UTA": 1610612762,
    "WAS": 1610612764,
}

LOGO_SOURCE_BASE = "https://databallr-next-migration.vercel.app/img/team-logos"
NBA_HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/260x190/{nba_id}.png"
AK_HEADSHOT_URL = (
    "https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{nba_id}.png"
)
DB_HEADSHOT_URL = (
    "https://bvwahamwfvolchcezxnw.supabase.co/storage/v1/object/public/nba_photos/{nba_id}.webp"
)
BBREF_HEADSHOT_URL = (
    "https://www.basketball-reference.com/req/202106291/images/headshots/{bbref_id}.jpg"
)

# NBA CDN "missing" placeholder (~4937 B, identical hash across players).
NBA_PLACEHOLDER_MD5_PREFIX = "7475ba96"
# Databallr Supabase generic silhouette (~8370 B, shared across ~800+ players).
DATABALLR_PLACEHOLDER_MD5 = "dfefe20b02725965e4ef3be66efbaa93"
MIN_CACHED_HEADSHOT_BYTES = 3_500

NAME_ALIASES: dict[str, str] = {
    "cliff robinson": "clifford robinson",
    "cj kupec": "c j kupec",
    "aj english": "a j english",
    "pj brown": "p j brown",
    "jd mccarthy": "j d mccarthy",
}


def name_keys(name: str) -> list[str]:
    """Normalized name variants for NBA / BBRef lookup."""
    base = normalize_name(name)
    keys = [base]
    alias = NAME_ALIASES.get(base)
    if alias:
        keys.append(alias)
    parts = base.split()
    if len(parts) >= 2 and len(parts[0]) == 2 and parts[0].isalpha():
        spaced = f"{parts[0][0]} {parts[0][1]} {' '.join(parts[1:])}"
        keys.append(spaced)
    if len(parts) >= 2 and len(parts[0]) == 1 and parts[0].isalpha():
        keys.append(f"{parts[0]} {parts[1]} {' '.join(parts[2:])}".strip())
    out: list[str] = []
    for key in keys:
        if key and key not in out:
            out.append(key)
    return out

TABLE_ID = "advanced"
BBREF_SLEEP_S = 2.5
DOWNLOAD_WORKERS = 10


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug_context(advanced_rows: list[dict]) -> dict[str, dict]:
    """One representative row per baseSlug (most recent era)."""
    ctx: dict[str, dict] = {}
    era_rank = {era: i for i, era in enumerate(ERA_TO_SEASON_END_YEARS)}
    for row in advanced_rows:
        slug = row["baseSlug"]
        prev = ctx.get(slug)
        if prev is None or era_rank.get(row["era"], -1) >= era_rank.get(prev["era"], -1):
            ctx[slug] = row
    return ctx


def slug_to_name_map(advanced_rows: list[dict]) -> dict[str, str]:
    return {slug: row["player"] for slug, row in slug_context(advanced_rows).items()}


def build_nba_name_index() -> dict[str, int]:
    index: dict[str, int] = {}
    for player in nba_players.get_players():
        key = normalize_name(player["full_name"])
        if key and key not in index:
            index[key] = int(player["id"])
    return index


def resolve_nba_id(name: str, nba_index: dict[str, int]) -> int | None:
    for key in name_keys(name):
        if key in nba_index:
            return nba_index[key]
    return None


def season_url(season_end_year: int) -> str:
    return (
        f"https://www.basketball-reference.com/leagues/NBA_{season_end_year}_advanced.html"
    )


def load_season_html(season_end_year: int) -> str:
    BBREF_HTML_CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = BBREF_HTML_CACHE / f"{season_end_year}.html"
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    resp = cffi_requests.get(
        season_url(season_end_year),
        impersonate="chrome",
        timeout=60,
    )
    resp.raise_for_status()
    cache_path.write_text(resp.text, encoding="utf-8")
    time.sleep(BBREF_SLEEP_S)
    return resp.text


def parse_bbref_links(html: str, season_end_year: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id=TABLE_ID)
    if table is None:
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            if TABLE_ID in comment:
                table = BeautifulSoup(comment, "html.parser").find("table", id=TABLE_ID)
                if table:
                    break
    if table is None:
        return []

    tbody = table.find("tbody")
    if tbody is None:
        return []

    rows: list[dict] = []
    for tr in tbody.find_all("tr"):
        if tr.get("class") and "thead" in tr.get("class", []):
            continue
        name_cell = tr.find("td", {"data-stat": "name_display"}) or tr.find(
            "th", {"data-stat": "name_display"}
        )
        if not name_cell:
            continue
        anchor = name_cell.find("a", href=True)
        if not anchor:
            continue
        href = anchor["href"]
        match = re.search(r"/players/[a-z]/([a-z0-9]+)\.html", href)
        if not match:
            continue
        team_cell = tr.find("td", {"data-stat": "team_name_abbr"})
        team = team_cell.get_text(strip=True).upper() if team_cell else ""
        if not team or team == "TOT":
            continue
        rows.append(
            {
                "name_key": normalize_name(anchor.get_text(strip=True)),
                "team": team,
                "season_end_year": season_end_year,
                "bbref_id": match.group(1),
            }
        )
    return rows


def build_bbref_index(season_years: range) -> dict[tuple[str, str, int], str]:
    index: dict[tuple[str, str, int], str] = {}
    for year in season_years:
        try:
            html = load_season_html(year)
            for row in parse_bbref_links(html, year):
                key = (row["name_key"], row["team"], row["season_end_year"])
                index.setdefault(key, row["bbref_id"])
        except Exception as exc:  # noqa: BLE001
            print(f"  bbref season {year} skipped: {exc}")
    return index


def team_matches(abbrev: str, bbref_team: str) -> bool:
    aliases = TEAM_ALIASES.get(abbrev, {abbrev})
    return bbref_team in aliases


def load_bbref_az_index() -> dict[str, list[dict]]:
    if not BBREF_INDEX_PATH.exists():
        return {}
    return json.loads(BBREF_INDEX_PATH.read_text(encoding="utf-8"))


def resolve_bbref_id_az(player_name: str, az_index: dict[str, list[dict]]) -> str | None:
    for key in name_keys(player_name):
        hits = az_index.get(key, [])
        if not hits:
            continue
        if len(hits) == 1:
            return hits[0]["bbrefId"]
        lowered = player_name.lower()
        for hit in hits:
            if hit["player"].lower() == lowered:
                return hit["bbrefId"]
        return hits[0]["bbrefId"]
    return None


def resolve_bbref_id(row: dict, bbref_index: dict[tuple[str, str, int], str]) -> str | None:
    era = row["era"]
    years = ERA_TO_SEASON_END_YEARS.get(era)
    if not years:
        return None

    for alias in name_keys(row["player"]):
        for year in years:
            for (n, team, season_year), bbref_id in bbref_index.items():
                if n != alias or season_year != year:
                    continue
                if team_matches(row["team"], team):
                    return bbref_id

    # Fallback: name + season year only (helps sparse team alias edge cases).
    for alias in name_keys(row["player"]):
        for year in years:
            for (n, _team, season_year), bbref_id in bbref_index.items():
                if n == alias and season_year == year:
                    return bbref_id
    return None


def is_placeholder_headshot(content: bytes) -> bool:
    if len(content) < 2_500:
        return True
    digest = hashlib.md5(content).hexdigest()
    if digest == DATABALLR_PLACEHOLDER_MD5:
        return True
    return len(content) <= 5_000 and digest.startswith(NBA_PLACEHOLDER_MD5_PREFIX)


def is_valid_cached_headshot(path: Path) -> bool:
    if not path.exists():
        return False
    data = path.read_bytes()
    if len(data) < MIN_CACHED_HEADSHOT_BYTES:
        return False
    return not is_placeholder_headshot(data)


def is_real_headshot(content: bytes, *, from_bbref: bool = False) -> bool:
    if is_placeholder_headshot(content):
        return False
    if from_bbref:
        return len(content) >= 3_500
    return len(content) >= 5_500


def fetch_bytes(url: str, *, use_cffi: bool = False) -> bytes | None:
    try:
        if use_cffi:
            resp = cffi_requests.get(url, impersonate="chrome", timeout=30)
        else:
            resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
        if not resp.ok:
            return None
        data = resp.content
        from_bbref = "basketball-reference.com" in url
        return data if is_real_headshot(data, from_bbref=from_bbref) else None
    except requests.RequestException:
        return None


def load_photo_overrides() -> dict[str, dict]:
    if not OVERRIDES_PATH.exists():
        return {}
    raw = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, dict)}


def download_headshot(
    base_slug: str,
    nba_id: int | None,
    bbref_id: str | None,
    *,
    image_url: str | None = None,
    force: bool = False,
) -> tuple[str | None, str]:
    HEADSHOT_DIR.mkdir(parents=True, exist_ok=True)

    for ext in (".png", ".jpg", ".webp"):
        existing = HEADSHOT_DIR / f"{base_slug}{ext}"
        if existing.exists() and not force:
            if is_valid_cached_headshot(existing):
                return f"/img/headshots/{base_slug}{ext}", "cached"
            existing.unlink(missing_ok=True)

    candidates: list[tuple[str, str, bool]] = []
    if image_url:
        use_cffi = "basketball-reference.com" in image_url
        candidates.append((image_url, _ext_from_url(image_url), use_cffi))
    if bbref_id:
        candidates.append(
            (BBREF_HEADSHOT_URL.format(bbref_id=bbref_id), ".jpg", True)
        )
    if nba_id is not None:
        candidates.append((DB_HEADSHOT_URL.format(nba_id=nba_id), ".webp", False))
        candidates.append((NBA_HEADSHOT_URL.format(nba_id=nba_id), ".png", False))
        candidates.append((AK_HEADSHOT_URL.format(nba_id=nba_id), ".png", False))

    for url, ext, use_cffi in candidates:
        data = fetch_bytes(url, use_cffi=use_cffi)
        if not data:
            continue
        dest = HEADSHOT_DIR / f"{base_slug}{ext}"
        dest.write_bytes(data)
        return f"/img/headshots/{base_slug}{ext}", url.split("/")[2]

    return None, "none"


def _ext_from_url(url: str) -> str:
    lowered = url.lower().split("?", 1)[0]
    for ext in (".webp", ".png", ".jpg", ".jpeg"):
        if lowered.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def fetch_team_logos(session: requests.Session) -> None:
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    for abbr, team_id in sorted(TEAM_NBA_IDS.items(), key=lambda x: x[0]):
        dest = LOGO_DIR / f"{team_id}.svg"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        url = f"{LOGO_SOURCE_BASE}/{team_id}.svg"
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        print(f"  logo {abbr} -> {dest.name}")
        time.sleep(0.15)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Only refresh JSON mapping; keep existing files in headshots/",
    )
    parser.add_argument(
        "--skip-bbref-scrape",
        action="store_true",
        help="Skip scraping BBRef season pages (use cached HTML only)",
    )
    parser.add_argument("--force", action="store_true", help="Re-download all headshots")
    parser.add_argument(
        "--purge-placeholders",
        action="store_true",
        help="Delete cached silhouette placeholders before downloading",
    )
    args = parser.parse_args()

    if args.purge_placeholders:
        removed = 0
        for path in HEADSHOT_DIR.glob("*"):
            if path.is_file() and not is_valid_cached_headshot(path):
                path.unlink(missing_ok=True)
                removed += 1
        print(f"Purged {removed} invalid placeholder headshot(s)")

    if not PLAYERS_PATH.exists():
        raise FileNotFoundError(f"{PLAYERS_PATH} missing. Run enrich_players.py first.")

    advanced = json.loads(PLAYERS_PATH.read_text(encoding="utf-8"))
    contexts = slug_context(advanced)
    slug_names = slug_to_name_map(advanced)
    nba_index = build_nba_name_index()

    print("Building Basketball-Reference player id index...")
    if args.skip_bbref_scrape and not any(BBREF_HTML_CACHE.glob("*.html")):
        print("  No cached BBRef HTML — run without --skip-bbref-scrape once.")
        bbref_index: dict[tuple[str, str, int], str] = {}
    else:
        years = range(min(y for r in ERA_TO_SEASON_END_YEARS.values() for y in r), 2027)
        if args.skip_bbref_scrape:
            bbref_index = {}
            for path in sorted(BBREF_HTML_CACHE.glob("*.html")):
                year = int(path.stem)
                for row in parse_bbref_links(path.read_text(encoding="utf-8"), year):
                    key = (row["name_key"], row["team"], row["season_end_year"])
                    bbref_index.setdefault(key, row["bbref_id"])
        else:
            bbref_index = build_bbref_index(years)
    print(f"  BBRef index keys: {len(bbref_index)}")

    overrides = load_photo_overrides()
    if overrides:
        print(f"Loaded {len(overrides)} manual photo override(s)")

    az_index = load_bbref_az_index()
    if az_index:
        print(f"Loaded BBRef A–Z index ({len(az_index)} name keys)")
    else:
        print("No BBRef A–Z index — run build_bbref_player_index.py")

    matched: dict[str, dict] = {}
    unmatched: list[dict] = []
    download_jobs: list[tuple[str, int | None, str | None, str | None]] = []

    for base_slug in sorted(slug_names):
        row = contexts[base_slug]
        manual = overrides.get(base_slug, {})
        nba_id = manual.get("nbaId") or resolve_nba_id(row["player"], nba_index)
        bbref_id = (
            manual.get("bbrefId")
            or resolve_bbref_id(row, bbref_index)
            or resolve_bbref_id_az(row["player"], az_index)
        )
        image_url = manual.get("imageUrl")
        if nba_id is not None:
            nba_id = int(nba_id)
        if bbref_id is not None:
            bbref_id = str(bbref_id)

        if nba_id is None and bbref_id is None and not image_url:
            unmatched.append(
                {
                    "baseSlug": base_slug,
                    "player": row["player"],
                    "name_key": normalize_name(row["player"]),
                    "reason": "no_nba_or_bbref_id",
                }
            )
            continue

        download_jobs.append((base_slug, nba_id, bbref_id, image_url))
        matched[base_slug] = {
            "nbaId": nba_id,
            "bbrefId": bbref_id,
            "player": row["player"],
            "photoUrl": None,
            "source": "manual" if base_slug in overrides else None,
        }

    if not args.skip_download:
        print(f"Downloading headshots for {len(download_jobs)} players...")
        with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
            futures = {
                pool.submit(
                    download_headshot,
                    slug,
                    nba_id,
                    bbref_id,
                    image_url=image_url,
                    force=args.force,
                ): slug
                for slug, nba_id, bbref_id, image_url in download_jobs
            }
            done = 0
            for future in as_completed(futures):
                slug = futures[future]
                photo_url, source = future.result()
                done += 1
                if photo_url:
                    matched[slug]["photoUrl"] = photo_url
                    matched[slug]["source"] = source
                if done % 200 == 0:
                    print(f"  {done}/{len(download_jobs)}")

    # Fill photoUrl from disk for skip-download pass
    for slug, entry in matched.items():
        if entry.get("photoUrl"):
            continue
        for ext in (".png", ".jpg", ".webp"):
            path = HEADSHOT_DIR / f"{slug}{ext}"
            if is_valid_cached_headshot(path):
                entry["photoUrl"] = f"/img/headshots/{slug}{ext}"
                entry["source"] = "cached"
                break

    for slug, entry in matched.items():
        if not entry.get("photoUrl"):
            unmatched.append(
                {
                    "baseSlug": slug,
                    "player": entry["player"],
                    "name_key": normalize_name(entry["player"]),
                    "reason": "no_headshot_file",
                }
            )

    OUT_PATH.write_text(
        json.dumps(matched, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    if unmatched:
        import pandas as pd

        pd.DataFrame(unmatched).to_csv(UNMATCHED_PATH, index=False)
    elif UNMATCHED_PATH.exists():
        UNMATCHED_PATH.unlink()

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    print("Fetching team logos...")
    fetch_team_logos(session)

    total = len(slug_names)
    with_photo = sum(1 for e in matched.values() if e.get("photoUrl"))
    print(f"Wrote {OUT_PATH} ({with_photo} with images / {total} slugs)")
    print(f"Coverage: {with_photo / total:.1%}")
    if unmatched:
        print(f"Unmatched log: {UNMATCHED_PATH} ({len(unmatched)} slugs)")


if __name__ == "__main__":
    main()
