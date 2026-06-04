# Better 82-0

Local fan build of the [82-0](https://www.82-0.com/) draft game using advanced stats (**WS/48, VORP, OBPM, DBPM, PER**) instead of box-score totals. Not affiliated with 82-0.com or the NBA.

**Agents / maintainers:** see [HANDOFF.md](./HANDOFF.md) for architecture, deploy, and game rules.

**Live demo:** Deploy via Vercel (see below) or run locally.

## Play locally

```bash
cd web
npm install
npm run dev
```

## Deploy for friends (free)

1. Push this repo to GitHub.
2. Import the repo on [Vercel](https://vercel.com/new).
3. Leave **Root Directory** empty (repo root). The root `vercel.json` builds the `web/` Vite app and ignores the Python data scripts.
4. Deploy — output is `web/dist`.

If Vercel still detects Python, set **Root Directory** to `web` in Project Settings → General and redeploy.

Share the `*.vercel.app` URL. Optional: add a custom domain in Vercel.

## Data pipeline

Player metrics come from Basketball Reference (1974–present), merged onto the public 82-0 player list. Eras **1950s** and **1960s** are excluded.

```bash
pip install -r requirements.txt
python scripts/fetch_bbref_seasons.py
python scripts/enrich_players.py
```

Output: `data/players_advanced.json` (bundled into the web app at build time).

## License / notes

For personal use among friends. Do not imply endorsement by 82-0.com or the NBA.
