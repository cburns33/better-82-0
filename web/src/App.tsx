import { BarChart3, Brain, Trophy } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { PlayerCard } from '@/components/PlayerCard'
import { PositionFilter, type PositionFilterValue } from '@/components/PositionFilter'
import { SlotMachine } from '@/components/SlotMachine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  buildTeams,
  filterPoolByPosition,
  getEligibleSlots,
  getOpenSlots,
  getPool,
  loadPlayers,
  resolveValidSlot,
  type SpinResolveOptions,
} from '@/lib/data'
import { sortPlayerPool } from '@/lib/sortPool'
import { calculateTeamResult } from '@/lib/simulation'
import { teamColors } from '@/lib/teams'
import { cn } from '@/lib/utils'
import type { Era, GameMode, Player, SlotResult } from '@/types'
import { DECADES, POSITIONS } from '@/types'

type Phase = 'menu' | 'spin' | 'pick' | 'done'

const ROUNDS = 5

function MetadataChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function ModeChoiceCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-1 flex-col items-start rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-[box-shadow,transform,border-color] hover:border-primary/40 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35)] active:scale-[0.96]"
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
        {icon}
      </div>
      <p className="font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </button>
  )
}

function AppShell({
  children,
  constrain,
  wide,
}: {
  children: ReactNode
  /** Lock to viewport height so inner lists can scroll (draft screen). */
  constrain?: boolean
  /** Wider shell for split slot + pick layout on desktop. */
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col mx-auto px-4',
        wide ? 'w-full max-w-5xl' : 'max-w-2xl',
        constrain ? 'h-dvh max-h-dvh overflow-hidden py-3 sm:py-4' : 'min-h-screen py-6 sm:py-8',
      )}
    >
      {children}
    </div>
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
  const [spinTarget, setSpinTarget] = useState<SlotResult | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinLocks, setSpinLocks] = useState({ team: false, decade: false })
  const [teamSkipLeft, setTeamSkipLeft] = useState(true)
  const [decadeSkipLeft, setDecadeSkipLeft] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [positionFilter, setPositionFilter] = useState<PositionFilterValue>('ALL')

  const openSlots = useMemo(() => getOpenSlots(roster), [roster])
  const openPositions = useMemo(() => openSlots.map((s) => s.position), [openSlots])
  const teamList = useMemo(
    () => teams.map((t) => t.abbreviation).sort((a, b) => a.localeCompare(b)),
    [teams],
  )
  const decadeLabels = useMemo(() => DECADES.map((d) => d.label), [])

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
    () => (selectedPlayer ? getEligibleSlots(selectedPlayer, roster) : []),
    [selectedPlayer, roster],
  )

  const result = useMemo(
    () => (phase === 'done' ? calculateTeamResult(roster, mode) : null),
    [phase, roster, mode],
  )

  const resolveSpin = useCallback(
    (opts?: SpinResolveOptions): SlotResult =>
      resolveValidSlot(teams, teamList, roster, usedIds, usedEras, opts ?? {}, slot),
    [teams, teamList, roster, usedIds, usedEras, slot],
  )

  const completeSpin = useCallback(() => {
    setSpinTarget((target) => {
      if (target) setSlot(target)
      return null
    })
    setSpinning(false)
    setPhase('pick')
  }, [])

  const spinSlot = useCallback(
    (opts?: SpinResolveOptions) => {
      setSelectedPlayer(null)
      setPositionFilter('ALL')
      setSlot(null)
      setSpinLocks({ team: Boolean(opts?.keepTeam), decade: Boolean(opts?.keepDecade) })
      setSpinTarget(resolveSpin(opts))
      setSpinning(true)
      setPhase('spin')
    },
    [resolveSpin],
  )

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode)
    setRound(0)
    setRoster(Array(ROUNDS).fill(null))
    setUsedIds(new Set())
    setUsedEras(new Set())
    setSlot(null)
    setSpinTarget(null)
    setSpinning(false)
    setSelectedPlayer(null)
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
    setSelectedPlayer(null)

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
    setSelectedPlayer(player)
  }

  const skipTeam = () => {
    if (!teamSkipLeft || !slot) return
    setTeamSkipLeft(false)
    setSelectedPlayer(null)
    spinSlot({ keepDecade: true, excludeTeam: slot.team })
  }

  const skipDecade = () => {
    if (!decadeSkipLeft || !slot) return
    setDecadeSkipLeft(false)
    setSelectedPlayer(null)
    spinSlot({ keepTeam: true, excludeEra: slot.era })
  }

  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <Trophy className="size-8" aria-hidden />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-center text-balance">Better 82-0</h1>
        <p className="mt-3 text-muted-foreground text-center max-w-md text-sm leading-relaxed text-pretty">
          Build an all-time starting five (1970s–2020s) with WS/48, VORP, OBPM, DBPM, and PER.
          Fan project — not affiliated with 82-0.com.
        </p>
        <div className="mt-10 w-full max-w-md">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Choose mode
          </p>
          <p className="text-center text-xs text-muted-foreground mb-4">
            Five rounds · one pick per slot spin
          </p>
          <div className="flex gap-3">
            <ModeChoiceCard
              title="Classic"
              description="Stats visible — pick by strength"
              icon={<BarChart3 className="size-5" aria-hidden />}
              onClick={() => startGame('classic')}
            />
            <ModeChoiceCard
              title="HoopIQ"
              description="Stats hidden — pick from memory"
              icon={<Brain className="size-5" aria-hidden />}
              onClick={() => startGame('hoopiq')}
            />
          </div>
        </div>
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

  const machineTarget = spinTarget ?? slot
  const machineSpinning = spinning && spinTarget != null
  const openLabel = openPositions.length > 0 ? openPositions.join(', ') : '—'
  const isPickPhase = phase === 'pick'

  const slotMachineBlock = machineTarget ? (
    <SlotMachine
      teamOptions={teamList}
      decadeOptions={decadeLabels}
      target={{ team: machineTarget.team, decadeLabel: machineTarget.decadeLabel }}
      spinning={machineSpinning}
      lockTeam={machineSpinning && spinLocks.team}
      lockDecade={machineSpinning && spinLocks.decade}
      onComplete={machineSpinning ? completeSpin : undefined}
      renderTeam={(team, active) => {
        const colors = teamColors(team)
        return (
          <div className="relative flex items-center justify-center">
            {active && (
              <div
                className="pointer-events-none absolute inset-0 -m-2 rounded-lg opacity-40 blur-md"
                style={{ backgroundColor: colors.bg }}
                aria-hidden
              />
            )}
            <Badge
              className={cn(
                'relative border-0 font-black h-auto text-lg px-3 py-1.5',
                active && 'scale-[1.02] shadow-[0_0_16px_-2px_var(--tw-shadow-color)]',
              )}
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                ...(active ? { '--tw-shadow-color': colors.bg } as React.CSSProperties : {}),
              }}
            >
              {team}
            </Badge>
          </div>
        )
      }}
      renderDecade={(label, active) => (
        <span
          className={cn(
            'text-xl font-bold text-primary tabular-nums',
            active && 'scale-[1.02]',
          )}
        >
          {label}
        </span>
      )}
    />
  ) : (
    <Button onClick={() => spinSlot()} className="w-full">
      Spin
    </Button>
  )

  return (
    <AppShell constrain wide>
      <header className="mb-3 shrink-0 text-center md:mb-4">
        <h1 className="text-xl font-bold tracking-tight text-balance md:text-2xl">Better 82-0</h1>
        <div className="mt-1.5 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
            Round {round + 1} of {ROUNDS}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {isPickPhase && slot && (
            <MetadataChip>
              {pool.length} player{pool.length === 1 ? '' : 's'}
            </MetadataChip>
          )}
          <MetadataChip>Open: {openLabel}</MetadataChip>
          <MetadataChip>{mode === 'classic' ? 'Classic' : 'HoopIQ'}</MetadataChip>
        </div>
      </header>

      <div className="mb-3 grid shrink-0 grid-cols-5 gap-1 md:mb-4 md:gap-1.5">
        {POSITIONS.map((pos, i) => {
          const filled = roster[i]
          const isOpen = filled == null
          const slotColors = filled ? teamColors(filled.team) : null
          return (
            <div
              key={pos}
              className={cn(
                'rounded-md border py-1 px-0.5 text-center text-[10px] transition-[border-color,background-color,box-shadow] md:rounded-lg md:py-2 md:px-1 md:text-xs',
                isOpen
                  ? 'border-primary/60 bg-primary/10 shadow-[0_0_12px_-4px_oklch(0.75_0.16_75/0.35)]'
                  : 'border-border/60 bg-card/50',
              )}
              style={
                filled && slotColors
                  ? {
                      backgroundColor: `${slotColors.bg}18`,
                      borderColor: `${slotColors.bg}55`,
                    }
                  : undefined
              }
            >
              <div className="font-bold text-foreground">{pos}</div>
              <div className="mt-0 truncate text-[9px] text-muted-foreground md:mt-0.5 md:text-[10px]">
                {filled?.player.split(' ').pop() ?? 'open'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6">
        <aside className="w-full shrink-0 md:w-[272px]">
          <Card className="border-border/60 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.35)]">
            <CardContent className="pt-5 pb-5">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Slot machine
              </p>
              {slotMachineBlock}
              {isPickPhase && slot && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={teamSkipLeft ? 'default' : 'outline'}
                    disabled={!teamSkipLeft}
                    onClick={skipTeam}
                  >
                    Skip team {teamSkipLeft ? '(1)' : '(used)'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!decadeSkipLeft}
                    onClick={skipDecade}
                  >
                    Skip decade {decadeSkipLeft ? '(1)' : '(used)'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {phase === 'spin' && !spinning && !slot && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Press Spin to start this round.
            </p>
          )}
        </aside>

        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden transition-[opacity,transform] duration-500 ease-out',
            isPickPhase
              ? 'min-h-[240px] flex-1 opacity-100 translate-x-0 md:min-h-0'
              : 'hidden md:flex md:w-0 md:min-w-0 md:flex-none md:opacity-0 md:translate-x-6 md:pointer-events-none md:overflow-hidden',
          )}
        >
          <section
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/30 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.35)]',
              selectedPlayer && 'pb-24',
            )}
          >
            <div className="shrink-0 border-b border-border/60 px-3 pb-2 pt-3">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Choose a player
              </p>
              <PositionFilter
                value={positionFilter}
                onChange={setPositionFilter}
                openPositions={openPositions}
                compact
              />
            </div>
            {pool.length === 0 ? (
              <p className="py-8 text-center text-sm text-primary">
                {positionFilter !== 'ALL'
                  ? `No matches for ${positionFilter}. Try another filter or a skip.`
                  : 'No eligible players. Try a skip.'}
              </p>
            ) : (
              <ScrollArea className="min-h-0 flex-1 px-3">
                <ul className="space-y-1 pb-3 pr-2 pt-2">
                  {pool.map((p) => {
                    const eligible = getEligibleSlots(p, roster).map((s) => s.position)
                    return (
                      <li key={p.id}>
                        <PlayerCard
                          player={p}
                          mode={mode}
                          density="compact"
                          eligiblePositions={eligible}
                          selected={selectedPlayer?.id === p.id}
                          onSelect={() => onChoosePlayer(p)}
                        />
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </section>
        </div>
      </div>

      {phase === 'pick' && selectedPlayer && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
            <p className="text-center text-xs text-muted-foreground truncate">
              <span className="font-semibold text-foreground">{selectedPlayer.player}</span>
              {pendingSlots.length === 1
                ? ` · assign to ${pendingSlots[0]!.position}`
                : ' · choose a position'}
            </p>
            {pendingSlots.length === 1 ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedPlayer(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-[2]"
                  onClick={() => assignPlayer(selectedPlayer, pendingSlots[0]!.index)}
                >
                  Confirm pick
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedPlayer(null)}
                >
                  Cancel
                </Button>
                <div
                  className={cn(
                    'grid flex-1 gap-2',
                    pendingSlots.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
                  )}
                >
                  {pendingSlots.map(({ position, index }) => (
                    <Button key={position} onClick={() => assignPlayer(selectedPlayer, index)}>
                      {position}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default App
