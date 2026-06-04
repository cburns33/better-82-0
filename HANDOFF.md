# Better 82-0 — Evergreen handoff

> **For agents:** This file is loaded via `.cursor/rules/read-handoff.mdc` (`alwaysApply: true`). Still **read `HANDOFF.md` with the Read tool** at the start of substantive work. Work from the **project root** (`82-0-metrics` / `better-82-0`), not the user home directory. Prefer small, focused diffs. Do not commit or push unless the user asks.

**Repo:** https://github.com/cburns33/better-82-0  
**Local path (typical):** `~/Projects/82-0-metrics`  
**What it is:** Fan remake of [82-0.com](https://www.82-0.com/) — five-round draft by **team + decade**, using **WS/48, VORP, OBPM, DBPM, PER** (not box-score stats). Personal / friends use; not affiliated with 82-0 or the NBA.

---

## Quick commands

| Task | Command |
|------|---------|
| Dev server | `cd web && npm install && npm run dev` |
| Production build | `npm run build` from repo root (delegates to `web/`) |
| Refresh metrics data | `pip install -r requirements.txt` then `python scripts/fetch_bbref_seasons.py` and `python scripts/enrich_players.py` |
| Deploy | Push `main` → Vercel auto-builds (see **Deploy**) |

---

## Repository layout

```
better-82-0/
├── HANDOFF.md              ← this file (update when behavior/architecture changes)
├── README.md               ← user-facing quick start
├── vercel.json             ← Vercel: build web/, ignore Python at deploy time
├── package.json            ← root npm scripts → web/
├── .vercelignore           ← excludes requirements.txt, scripts/ from deploy bundle
├── data/
│   ├── players_advanced.json   ← bundled into Vite build (~10k rows)
│   ├── cache/seasons/            ← BBRef scrape cache (not required on Vercel)
│   └── unmatched_rows.csv
├── scripts/                ← Python pipeline (local only on Vercel)
│   ├── config.py           ← era ranges, TEAM_ALIASES, metrics columns
│   ├── fetch_bbref_seasons.py
│   └── enrich_players.py
└── web/                    ← Vite + React 19 + Tailwind v4 app
    ├── src/
    │   ├── App.tsx         ← game state machine, skips, slot UI wiring
    │   ├── components/
    │   │   ├── SlotMachine.tsx
    │   │   ├── PlayerCard.tsx
    │   │   ├── PositionFilter.tsx
    │   │   └── ui/         ← shadcn-style primitives (manual, no CLI)
    │   └── lib/
    │       ├── data.ts     ← pool, eligibility, resolveValidSlot
    │       ├── simulation.ts
    │       ├── sortPool.ts
    │       └── teams.ts    ← TEAM_COLORS
    └── vercel.json         ← optional if Root Directory = web in dashboard
```

---

## Deploy (Vercel)

- **Framework:** Vite (not Python).
- **Root directory:** `.` (repo root). Root `vercel.json` runs `npm install --prefix web` and `npm run build --prefix web`, output `web/dist`.
- **If build fails with “No python entrypoint”:** ensure `vercel.json` + `package.json` exist at root and `.vercelignore` lists `requirements.txt`. Dashboard framework preset = **Vite**.
- **Common deploy mistake:** `App.tsx` imports a component that was never committed (e.g. `SlotMachine.tsx`) — always run `npm run build` locally before pushing.

---

## Game design (implemented)

| Rule | Behavior |
|------|----------|
| Rounds | 5 picks → fill PG, SG, SF, PF, C |
| Spin | Random **team** + **decade** (1970s–2020s; 50s/60s excluded from data) |
| Pool | Players on that team in that era who can fill **any open roster slot** |
| Position filter | UI filter; does not change eligibility rules |
| Skip team (×1) | New team, **same decade** — `keepDecade` + `excludeTeam` |
| Skip decade (×1) | Same team, **new decade** — `keepTeam` + `excludeEra` |
| Used decades | After a pick, that spin’s era is avoided on later spins until all six used |
| Classic mode | Stats visible; pool sorted by strength |
| HoopIQ mode | Stats hidden on cards; pool A–Z |
| Win calc | **Lineup averages** of advanced stats (not sums); curve `82 × min(ovr/110, 1)^exp` (Classic exp 1.15, HoopIQ geometric mean + exp 2.2) |

**Slot machine UI:** Single mounted `SlotMachine` for spin + pick (`machineTarget = spinTarget ?? slot`). Reels spin forward from current offset; locked reel on skip team/decade. No center payline.

**Valid spins:** `resolveValidSlot()` in `web/src/lib/data.ts` only picks team+era combos where `getPool()` is non-empty for current open slots. Prevents empty lists from impossible spins (e.g. CHA 1970s has no rows).

---

## Data pipeline

1. **Source list:** 82-0 `players_flat.json` (Firebase URL in `scripts/config.py`).
2. **Metrics:** Basketball Reference advanced tables, scraped via `curl_cffi` (Cloudflare) into `data/cache/seasons/`.
3. **Enrich:** Peak metric per player×team×decade (`scripts/enrich_players.py`) → `data/players_advanced.json`.
4. **Web:** `web/src/lib/data.ts` imports JSON; `loadPlayers()` drops rows with no ws48/vorp/per.

**Team aliases:** `TEAM_ALIASES` in `scripts/config.py` maps 82-0 abbrevs to BBRef codes (e.g. OKC→SEA, BKN→BRK/NJN).

**Known sparse combos (0 players in JSON):** e.g. CHA/DAL/MEM/MIA/MIN/NOP/ORL/TOR in early decades — expansion/history gaps, not a bug. Spins should avoid these via `resolveValidSlot`; late-game empty pools can still happen if only one position is open and no one qualifies.

---

## Key files to touch

| Change | Start here |
|--------|------------|
| Draft / spin / skips | `web/src/App.tsx`, `web/src/lib/data.ts` |
| Slot animation | `web/src/components/SlotMachine.tsx` |
| Win formula / grades | `web/src/lib/simulation.ts` |
| Player card / metrics display | `web/src/components/PlayerCard.tsx` |
| New metrics / data refresh | `scripts/*`, regenerate `players_advanced.json` |
| Deploy | `vercel.json`, root `package.json`, `.vercelignore` |

---

## Conventions

- **TypeScript:** strict; path alias `@/` → `web/src/`.
- **UI:** Tailwind v4 + manual shadcn-style components (`web/src/components/ui/`). shadcn CLI init failed on Windows — don’t rerun without user ask.
- **Scope:** Minimal diffs; match existing patterns.
- **Git:** Commit/push only when user requests.
- **Tests:** No test suite yet; verify with `cd web && npm run build`.

---

## What we did *not* use

- **Vercel agent-browser** — not used to explore 82-0 or other sites; design/data came from manual reverse engineering + BBRef pipeline.
- **Original 82-0 as UX reference** — user considers it “lame”; don’t re-copy without intent.

---

## Agent session tips

1. Open workspace at **project root**, not home.
2. New chat per milestone (bugs vs big UI pass) is fine; paste a 3-bullet summary or point to this file.
3. For bugs: repro steps + deploy log + screenshot.
4. Bundle size ~3.7MB JS (large JSON import) — code-split only if user asks.

---

## Changelog (high level)

Update this section when merging meaningful work.

| Date / commit area | Notes |
|--------------------|--------|
| `60801c8` | Initial game + data + Vercel |
| `bff3438` | shadcn-style UI |
| `bf01f5b` | Vercel Vite fix (root vercel.json) |
| `72268ef` | Draft list scroll (`ScrollArea`, `h-dvh` layout) |
| `42d3802` / `1c3c580` | Slot machine component + deploy fix |
| `d8c3cee` | `resolveValidSlot`, skip decade exclude era, skip team keep decade |
| `342b061` | Single SlotMachine instance, spin from current offset, remove payline |

---

## Open ideas (not scheduled)

- Code-split / lazy-load player JSON
- Sound on slot stop
- Further simulation tuning vs original 82-0 feel
- Custom domain on Vercel
- Explore reference sites with agent-browser for UX only (user preference: not 82-0.com)

---

## License / intent

Personal fan project for friends. No commercial use implied; no NBA/82-0 endorsement.
