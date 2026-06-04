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
| UX explore / verify UI | `agent-browser open <url>` → `snapshot -i -c` → `close` (see `.cursor/rules/design-agent-browser.mdc`) |
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
    │   ├── App.tsx         ← game state machine, split layout, skips, pick confirm bar
    │   ├── components/
    │   │   ├── SlotMachine.tsx   ← GSAP reels (team + decade)
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

**Slot machine UI (current):**

- **Layout:** `md+` split — fixed **272px left column** (slot + skips during pick); **pick panel slides in on the right** when `phase === 'pick'`. Mobile: **stacked** (slot on top, list below). Shell `max-w-5xl`; slot column does not shrink after spin.
- **Animation:** GSAP (`gsap` + `@gsap/react`) in `SlotMachine.tsx` — anticipation nudge, decelerating spin, staggered reels (team then decade), bounce on lock. Strip position **rewinds to cycle 0** at spin start so animation never scrolls past strip end; **3 buffer rows** at strip tail for overshoot.
- **Pick flow:** Tap player → **sticky bottom confirm bar** (single slot = Confirm/Cancel; multi = position buttons). No instant assign.
- **Single mounted machine:** `machineTarget = spinTarget ?? slot` for spin + pick; locked reel on skip team/decade. Reels stay **fixed size** — no settle/shrink morph (removed `slotSettled`).
- **Player list:** Compact rows (`PlayerCard density="compact"`), horizontal position filters during pick.

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
| Draft / spin / skips / layout | `web/src/App.tsx`, `web/src/lib/data.ts` |
| Slot animation (GSAP) | `web/src/components/SlotMachine.tsx` — tune `SPIN_CYCLES`, `STAGGER_S`, durations in timeline |
| Win formula / grades | `web/src/lib/simulation.ts` |
| Player card / metrics display | `web/src/components/PlayerCard.tsx` |
| New metrics / data refresh | `scripts/*`, regenerate `players_advanced.json` |
| Deploy | `vercel.json`, root `package.json`, `.vercelignore` |

---

## Conventions

- **TypeScript:** strict; path alias `@/` → `web/src/`.
- **UI:** Tailwind v4 + manual shadcn-style components (`web/src/components/ui/`). shadcn CLI init failed on Windows — don’t rerun without user ask.
- **Animation:** GSAP for slot reels only; prefer CSS transitions for layout (pick panel slide-in).
- **Scope:** Minimal diffs; match existing patterns.
- **Git:** Commit/push only when user requests.
- **Tests:** No test suite yet; verify with `cd web && npm run build`.

---

## Design exploration (agent-browser)

- **CLI:** Global `agent-browser` (v0.27+). Rule: `.cursor/rules/design-agent-browser.mdc` (applies when editing `web/src/**`).
- **Reference sites:** OK for UX research; capture snapshots/screenshots as evidence.
- **Not a design reference:** [82-0.com](https://www.82-0.com/) unless the user explicitly asks — game/data logic was reverse-engineered separately.

---

## Agent session tips

1. Open workspace at **project root**, not home.
2. New chat per milestone (bugs vs big UI pass) is fine; paste a 3-bullet summary or point to this file.
3. For bugs: repro steps + deploy log + screenshot.
4. Bundle size ~3.85MB JS (large JSON import + GSAP) — code-split only if user asks.
5. **Don’t reintroduce** shrink/settle on the slot module — use split layout or hard swap if pick phase needs more space.

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
| `3c630da` | Split layout (slot left / pick right), GSAP reels + strip bounds fix, compact list, sticky confirm, UI polish |

---

## Open ideas (not scheduled)

- Code-split / lazy-load player JSON
- Sound on slot stop
- Further simulation tuning vs original 82-0 feel
- Custom domain on Vercel
- Wider pick panel animation tuning; optional desktop-only roster beside slot

---

## License / intent

Personal fan project for friends. No commercial use implied; no NBA/82-0 endorsement.
