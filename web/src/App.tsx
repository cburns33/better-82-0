import { Trophy } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { PlayerCard } from '@/components/PlayerCard'
import { PositionFilter, type PositionFilterValue } from '@/components/PositionFilter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  buildTeams,
  filterPoolByPosition,
  getEligibleSlots,
  getOpenSlots,
  getPool,
  loadPlayers,
} from '@/lib/data'
import { sortPlayerPool } from '@/lib/sortPool'
import { calculateTeamResult } from '@/lib/simulation'
import { teamColors } from '@/lib/teams'
import { cn } from '@/lib/utils'
import type { Era, GameMode, Player, SlotResult } from '@/types'
import { DECADES, POSITIONS } from '@/types'

type Phase = 'menu' | 'spin' | 'pick' | 'done'

const ROUNDS = 5

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 py-6 sm:py-8">{children}</div>
  )
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
        <div className="flex items-center gap-2 mb-2 text-primary">
          <Trophy className="size-8" aria-hidden />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-center">Better 82-0</h1>
        <p className="mt-3 text-muted-foreground text-center max-w-md text-sm leading-relaxed">
          Build an all-time starting five (1970s–2020s) with WS/48, VORP, OBPM, DBPM, and PER.
          Fan project — not affiliated with 82-0.com.
        </p>
        <Card className="mt-10 w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-base">Choose mode</CardTitle>
            <CardDescription>Five rounds · one pick per slot spin</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button size="lg" onClick={() => startGame('classic')}>
              Classic — stats visible
            </Button>
            <Button size="lg" variant="outline" onClick={() => startGame('hoopiq')}>
              HoopIQ — stats hidden
            </Button>
          </CardContent>
        </Card>
        <p className="mt-6 text-xs text-muted-foreground">
          {players.length.toLocaleString()} player entries
        </p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    return (
      <AppShell>
        <header className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Season complete</h1>
        </header>
        <Card
          className="border-2 text-center"
          style={{ borderColor: result.color }}
        >
          <CardContent className="pt-8 pb-8">
            <p
              className="text-6xl font-black tabular-nums tracking-tight"
              style={{ color: result.color }}
            >
              {result.wins}–{result.losses}
            </p>
            <p className="mt-2 text-xl font-semibold" style={{ color: result.color }}>
              {result.grade} · {result.label}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Team strength <span className="font-mono text-foreground">{result.teamOvr}</span>
            </p>
          </CardContent>
        </Card>
        <div className="mt-6 space-y-2">
          {roster.map((p, i) =>
            p ? (
              <PlayerCard key={p.id} player={p} mode="classic" eligiblePositions={[POSITIONS[i]!]} />
            ) : null,
          )}
        </div>
        <Button size="lg" className="mt-8 w-full" onClick={() => setPhase('menu')}>
          Play again
        </Button>
      </AppShell>
    )
  }

  const slotColors = slot ? teamColors(slot.team) : null
  const openLabel = openPositions.length > 0 ? openPositions.join(', ') : '—'

  return (
    <AppShell>
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Better 82-0</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Round {round + 1}/{ROUNDS} · Open:{' '}
          <span className="text-primary font-medium">{openLabel}</span>
        </p>
        <Badge variant="secondary" className="mt-2">
          {mode === 'classic' ? 'Classic' : 'HoopIQ'}
        </Badge>
      </header>

      <div className="grid grid-cols-5 gap-1.5 mb-6">
        {POSITIONS.map((pos, i) => {
          const filled = roster[i]
          const isOpen = filled == null
          return (
            <div
              key={pos}
              className={cn(
                'rounded-lg border py-2 px-1 text-center text-xs transition-colors',
                isOpen ? 'border-primary/60 bg-primary/10' : 'border-border bg-card/50',
              )}
            >
              <div className="font-bold text-foreground">{pos}</div>
              <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                {filled?.player.split(' ').pop() ?? 'open'}
              </div>
            </div>
          )
        })}
      </div>

      <Card className="mb-6">
        <CardHeader className="text-center pb-2">
          <CardDescription className="uppercase tracking-widest text-xs">
            Slot machine
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-6">
          {spinning ? (
            <p className="text-2xl font-bold animate-pulse text-primary">Spinning…</p>
          ) : slot && slotColors ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Badge
                className="text-2xl font-black px-4 py-2 h-auto border-0"
                style={{ backgroundColor: slotColors.bg, color: slotColors.text }}
              >
                {slot.team}
              </Badge>
              <span className="text-2xl font-bold text-primary">{slot.decadeLabel}</span>
            </div>
          ) : (
            <Button onClick={() => spinSlot()}>Spin</Button>
          )}
          {phase === 'pick' && slot && (
            <>
              <Separator className="my-4" />
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!teamSkipLeft}
                  onClick={skipTeam}
                >
                  Skip team {teamSkipLeft ? '(1)' : '(used)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!decadeSkipLeft}
                  onClick={skipDecade}
                >
                  Skip decade {decadeSkipLeft ? '(1)' : '(used)'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {pendingPick && (
        <Card className="mb-4 border-primary/40 bg-primary/5">
          <CardContent className="pt-6 pb-6">
            <p className="text-sm font-semibold text-center mb-4">
              Assign <span className="text-primary">{pendingPick.player}</span> to:
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {pendingSlots.map(({ position, index }) => (
                <Button key={position} onClick={() => assignPlayer(pendingPick, index)}>
                  {position}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setPendingPick(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'pick' && !pendingPick && (
        <section className="flex-1 min-h-0 flex flex-col">
          <PositionFilter
            value={positionFilter}
            onChange={setPositionFilter}
            openPositions={openPositions}
          />
          <p className="text-sm text-muted-foreground mb-3">
            {pool.length} player{pool.length === 1 ? '' : 's'} · {slot?.team} ({slot?.decadeLabel})
            {positionFilter !== 'ALL' ? ` · ${positionFilter}` : ''}
            {mode === 'hoopiq' ? ' · A–Z' : ' · by strength'}
          </p>
          {pool.length === 0 ? (
            <p className="text-center text-primary py-8 text-sm">
              {positionFilter !== 'ALL'
                ? `No matches for ${positionFilter}. Try another filter or a skip.`
                : 'No eligible players. Try a skip.'}
            </p>
          ) : (
            <ScrollArea className="max-h-[50vh] flex-1">
              <ul className="space-y-2 pr-2">
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
            </ScrollArea>
          )}
        </section>
      )}

      {phase === 'spin' && !spinning && !slot && (
        <p className="text-center text-muted-foreground text-sm">Press Spin to start this round.</p>
      )}
    </AppShell>
  )
}

export default App
