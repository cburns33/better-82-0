"""Fetch BBRef seasons (if needed) and build players_advanced.json."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    scripts = ROOT / "scripts"
    subprocess.check_call([sys.executable, str(scripts / "fetch_bbref_seasons.py")], cwd=ROOT)
    subprocess.check_call([sys.executable, str(scripts / "enrich_players.py")], cwd=scripts)


if __name__ == "__main__":
    main()
