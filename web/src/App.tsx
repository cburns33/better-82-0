import { useCallback, useMemo, useState } from 'react'
import { PlayerCard } from './components/PlayerCard'
import { PositionFilter, type PositionFilterValue } from './components/PositionFilter'
import {
  buildTeams,
  filterPoolByPosition,
  getEligibleSlots,
  getOpenSlots,
  getPool,
  loadPlayers,
} from './lib/data'
import { sortPlayerPool } from './lib/sortPool'
import { calculateTeamResult } from './lib/simulation'
import { teamColors } from './lib/teams'
import type { Era, GameMode, Player, SlotResult } from './types'
import { DECADES, POSITIONS } from './types'

type Phase = 'menu' | 'spin' | 'pick' | 'done'

const ROUNDS = 5

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function App() {
  const players = useMemo(() => loadPlayers(), [])
  const teams = useMemo(() => buildTeams(players), [players])

  const [phase, setPhase] = useState<Phase>('menu')
  const [mode, setMode] = useState<GameMode>('classic')
  const [round, setRound] = useState(0)
  const [roster, setRoster] = useState<(Player | null)[]>(Array(ROUNDS).fill(null))
  const [usedIds, setUsedIds] = useState<Set<string>>(() => new Set())
  const [usedEras, setUsedEras] = useState<Set<Era>>(() => new Set())
  const [slot, setSlot] = useState<SlotResult | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [teamSkipLeft, setTeamSkipLeft] = useState(true)
  const [decadeSkipLeft, setDecadeSkipLeft] = useState(true)
  const [pendingPick, setPendingPick] = useState<Player | null>(null)
  const [positionFilter, setPositionFilter] = useState<PositionFilterValue>('ALL')

  const openSlots = useMemo(() => getOpenSlots(roster), [roster])
  const openPositions = useMemo(() => openSlots.map((s) => s.position), [openSlots])
  const teamList = useMemo(() => teams.map((t) => t.abbreviation), [teams])

  const pool = useMemo(() => {
    if (!slot || phase !== 'pick') return []
    const list = getPool(teams, slot.team, slot.era, roster, usedIds)
    const filtered = filterPoolByPosition(
      list,
      positionFilter === 'ALL' ? null : positionFilter,
    )
    return sortPlayerPool(filtered, mode)
  }, [teams, slot, phase, roster, usedIds, positionFilter, mode])

  const pendingSlots = useMemo(
    () => (pendingPick ? getEligibleSlots(pendingPick, roster) : []),
    [pendingPick, roster],
  )

  const result = useMemo(
    () => (phase === 'done' ? calculateTeamResult(roster, mode) : null),
    [phase, roster, mode],
  )

  const spinSlot = useCallback(
    (opts?: { keepTeam?: boolean; keepDecade?: boolean }) => {
      setSpinning(true)
      setPhase('spin')
      setPendingPick(null)
      setPositionFilter('ALL')

      window.setTimeout(() => {
        const availableEras = DECADES.map((d) => d.era).filter((e) => !usedEras.has(e))
        const era =
          opts?.keepDecade && slot
            ? slot.era
            : availableEras.length > 0
              ? random(availableEras)
              : random(DECADES.map((d) => d.era))

        const team = opts?.keepTeam && slot ? slot.team : random(teamList)
        const decadeLabel = DECADES.find((d) => d.era === era)!.label

        setSlot({ team, era, decadeLabel })
        setSpinning(false)
        setPhase('pick')
      }, 900)
    },
    [slot, teamList, usedEras],
  )

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode)
    setRound(0)
    setRoster(Array(ROUNDS).fill(null))
    setUsedIds(new Set())
    setUsedEras(new Set())
    setSlot(null)
    setPendingPick(null)
    setPositionFilter('ALL')
    setTeamSkipLeft(true)
    setDecadeSkipLeft(true)
    setPhase('spin')
    window.setTimeout(() => spinSlot(), 50)
  }

  const assignPlayer = (player: Player, slotIndex: number) => {
    const nextRoster = [...roster]
    nextRoster[slotIndex] = player
    setRoster(nextRoster)
    setUsedIds(new Set(usedIds).add(player.id))
    if (slot) setUsedEras(new Set(usedEras).add(slot.era))
    setPendingPick(null)

    if (round + 1 >= ROUNDS) {
      setPhase('done')
      setSlot(null)
    } else {
      setRound(round + 1)
      setPhase('spin')
      setSlot(null)
      window.setTimeout(() => spinSlot(), 400)
    }
  }

  const onChoosePlayer = (player: Player) => {
    const eligible = getEligibleSlots(player, roster)
    if (eligible.length === 0) return
    if (eligible.length === 1) {
      assignPlayer(player, eligible[0]!.index)
      return
    }
    setPendingPick(player)
  }

  const skipTeam = () => {
    if (!teamSkipLeft) return
    setTeamSkipLeft(false)
    setPendingPick(null)
    spinSlot()
  }

  const skipDecade = () => {
    if (!decadeSkipLeft || !slot) return
    setDecadeSkipLeft(false)
    setPendingPick(null)
    spinSlot({ keepTeam: true })
  }

  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-center">82-0</h1>
        <p className="mt-2 text-[var(--color-muted)] text-center max-w-md">
          Build an all-time starting five (1970s–2020s) using WS/48, VORP, OBPM, DBPM, and PER.
          Local fan build — not affiliated with 82-0.com.
        </p>
        <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => startGame('classic')}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 px-6 transition-colors"
          >
            Classic — stats visible
          </button>
          <button
            type="button"
            onClick={() => startGame('hoopiq')}
            className="rounded-lg border border-[var(--color-border)] hover:border-amber-400/50 py-3 px-6 font-semibold transition-colors"
          >
            HoopIQ — stats hidden
          </button>
        </div>
        <p className="mt-8 text-xs text-[var(--color-muted)]">{players.length.toLocaleString()} player entries loaded</p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    return (
      <div className="min-h-screen flex flex-col items-center px-4 py-10">
        <h1 className="text-3xl font-bold">Season complete</h1>
        <div
          className="mt-8 rounded-2xl border-2 p-8 text-center w-full max-w-md"
          style={{ borderColor: result.color }}
        >
          <p className="text-6xl font-black tabular-nums" style={{ color: result.color }}>
            {result.wins}–{result.losses}
          </p>
          <p className="mt-2 text-xl font-semibold" style={{ color: result.color }}>
            {result.grade} · {result.label}
          </p>
          <p className="mt-4 text-[var(--color-muted)]">Team strength: {result.teamOvr}</p>
        </div>
        <div className="mt-8 w-full max-w-lg space-y-2">
          {roster.map((p, i) =>
            p ? (
              <PlayerCard key={p.id} player={p} mode="classic" eligiblePositions={[POSITIONS[i]!]} />
            ) : null,
          )}
        </div>
        <button
          type="button"
          onClick={() => setPhase('menu')}
          className="mt-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 px-8"
        >
          Play again
        </button>
      </div>
    )
  }

  const slotColors = slot ? teamColors(slot.team) : null
  const openLabel = openPositions.length > 0 ? openPositions.join(', ') : '—'

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 py-6">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold">82-0</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Round {round + 1}/{ROUNDS} · Open spots:{' '}
          <span className="text-amber-400 font-semibold">{openLabel}</span>
        </p>
      </header>

      <div className="flex gap-1 mb-6">
        {POSITIONS.map((pos, i) => {
          const filled = roster[i]
          const isOpen = filled == null
          return (
            <div
              key={pos}
              className={`flex-1 rounded-md border py-2 text-center text-xs ${
                isOpen ? 'border-amber-400/70 bg-amber-400/10' : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-bold">{pos}</div>
              <div className="truncate px-1 text-[10px] text-[var(--color-muted)] mt-0.5">
                {filled?.player.split(' ').pop() ?? 'open'}
              </div>
            </div>
          )
        })}
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-3">Slot machine</p>
        {spinning ? (
          <p className="text-2xl font-bold animate-pulse text-amber-400">Spinning…</p>
        ) : slot && slotColors ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <span
              className="text-3xl font-black px-4 py-2 rounded-lg"
              style={{ backgroundColor: slotColors.bg, color: slotColors.text }}
            >
              {slot.team}
            </span>
            <span className="text-2xl font-bold text-amber-400">{slot.decadeLabel}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => spinSlot()}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 px-6"
          >
            Spin
          </button>
        )}
        {phase === 'pick' && slot && (
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!teamSkipLeft}
              onClick={skipTeam}
              className="text-xs rounded border border-[var(--color-border)] px-3 py-1 disabled:opacity-40 hover:border-amber-400/50"
            >
              Skip team {teamSkipLeft ? '(1 left)' : '(used)'}
            </button>
            <button
              type="button"
              disabled={!decadeSkipLeft}
              onClick={skipDecade}
              className="text-xs rounded border border-[var(--color-border)] px-3 py-1 disabled:opacity-40 hover:border-amber-400/50"
            >
              Skip decade {decadeSkipLeft ? '(1 left)' : '(used)'}
            </button>
          </div>
        )}
      </section>

      {pendingPick && (
        <section className="mb-4 rounded-xl border border-amber-400/50 bg-amber-400/5 p-4">
          <p className="text-sm font-semibold text-center mb-3">
            Assign <span className="text-amber-400">{pendingPick.player}</span> to:
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {pendingSlots.map(({ position, index }) => (
              <button
                key={position}
                type="button"
                onClick={() => assignPlayer(pendingPick, index)}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2"
              >
                {position}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPendingPick(null)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {phase === 'pick' && !pendingPick && (
        <section className="flex-1 min-h-0">
          <PositionFilter
            value={positionFilter}
            onChange={setPositionFilter}
            openPositions={openPositions}
          />
          <p className="text-sm text-[var(--color-muted)] mb-3">
            {pool.length} player{pool.length === 1 ? '' : 's'} from {slot?.team} ({slot?.decadeLabel})
            {positionFilter !== 'ALL' ? ` · ${positionFilter} only` : ''}
            {mode === 'hoopiq' ? ' · A–Z' : ' · by strength'}
          </p>
          {pool.length === 0 ? (
            <p className="text-center text-amber-400 py-8">
              {positionFilter !== 'ALL'
                ? `No one on this team/era matches ${positionFilter} and an open spot. Try another filter or a skip.`
                : 'No one on this team/era can fill your open positions. Try a skip.'}
            </p>
          ) : (
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {pool.map((p) => {
                const eligible = getEligibleSlots(p, roster).map((s) => s.position)
                return (
                  <li key={p.id}>
                    <PlayerCard
                      player={p}
                      mode={mode}
                      eligiblePositions={eligible}
                      onSelect={() => onChoosePlayer(p)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {phase === 'spin' && !spinning && !slot && (
        <p className="text-center text-[var(--color-muted)]">Press Spin to start this round.</p>
      )}
    </div>
  )
}

export default App
