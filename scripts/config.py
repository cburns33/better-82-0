from __future__ import annotations

PLAYERS_URL = (
    "https://firebasestorage.googleapis.com/v0/b/"
    "project-4599904239656435772.firebasestorage.app/o/players_flat.json?alt=media"
)

# Calendar decades -> Basketball-Reference season END years (e.g. 1996 = 1995-96 season).
ERA_TO_SEASON_END_YEARS: dict[str, range] = {
    "1970s": range(1971, 1981),
    "1980s": range(1981, 1991),
    "1990s": range(1991, 2001),
    "2000s": range(2001, 2011),
    "2010s": range(2011, 2021),
    "2020s": range(2021, 2027),
}

EXCLUDED_ERAS = {"1960s", "1950s"}

# 82-0 abbrev -> Basketball-Reference team codes (including historical).
TEAM_ALIASES: dict[str, set[str]] = {
    "ATL": {"ATL"},
    "BOS": {"BOS"},
    "BKN": {"BRK", "NJN", "BKN"},
    "CHA": {"CHA", "CHH", "CHO"},
    "CHI": {"CHI"},
    "CLE": {"CLE"},
    "DAL": {"DAL"},
    "DEN": {"DEN"},
    "DET": {"DET"},
    "GSW": {"GSW", "SFW"},
    "HOU": {"HOU"},
    "IND": {"IND"},
    "LAC": {"LAC", "SDC"},
    "LAL": {"LAL"},
    "MEM": {"MEM", "VAN"},
    "MIA": {"MIA"},
    "MIL": {"MIL"},
    "MIN": {"MIN"},
    "NOP": {"NOP", "NOH", "NOK", "NOL"},
    "NYK": {"NYK"},
    "OKC": {"OKC", "SEA"},
    "ORL": {"ORL"},
    "PHI": {"PHI"},
    "PHX": {"PHX"},
    "POR": {"POR"},
    "SAC": {"SAC", "KCK"},
    "SAS": {"SAS"},
    "TOR": {"TOR"},
    "UTA": {"UTA", "UTAH"},
    "WAS": {"WAS", "WSB"},
}

METRIC_COLUMNS = {
    "ws48": "ws_per_48",
    "vorp": "vorp",
    "obpm": "obpm",
    "dbpm": "dbpm",
    "per": "per",
}

# First season with reliable BPM / VORP on BBRef.
FIRST_ADVANCED_SEASON_END = 1974

USER_AGENT = "82-0-metrics-local/1.0 (personal research; contact: local)"
