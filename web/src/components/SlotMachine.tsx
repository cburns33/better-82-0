import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

const ITEM_HEIGHT = 64
const SPIN_CYCLES = 12
const SPIN_MS = 2400

type SlotReelProps<T extends string> = {
  items: readonly T[]
  value: T
  spinning: boolean
  locked?: boolean
  onStopped?: () => void
  renderItem: (item: T, active: boolean) => ReactNode
  ariaLabel: string
}

function SlotReel<T extends string>({
  items,
  value,
  spinning,
  locked = false,
  onStopped,
  renderItem,
  ariaLabel,
}: SlotReelProps<T>) {
  const stripRef = useRef<HTMLDivElement>(null)
  const stoppedRef = useRef(false)

  const targetIndex = Math.max(0, items.indexOf(value))

  const strip = useMemo(() => {
    const rows: T[] = []
    for (let c = 0; c < SPIN_CYCLES; c++) {
      for (const item of items) rows.push(item)
    }
    return rows
  }, [items])

  const finalOffset = ((SPIN_CYCLES - 1) * items.length + targetIndex) * ITEM_HEIGHT

  useEffect(() => {
    stoppedRef.current = false
    const el = stripRef.current
    if (!el) return

    const finish = () => {
      if (stoppedRef.current) return
      stoppedRef.current = true
      onStopped?.()
    }

    const setOffset = (px: number, animate: boolean) => {
      el.style.transition = animate
        ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.82, 0.22, 1)`
        : 'none'
      el.style.transform = `translate3d(0, ${-px}px, 0)`
    }

    if (!spinning) {
      setOffset(finalOffset, false)
      return
    }

    if (locked) {
      setOffset(finalOffset, false)
      finish()
      return
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      setOffset(finalOffset, false)
      finish()
      return
    }

    setOffset(0, false)
    void el.offsetHeight
    setOffset(finalOffset, true)

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return
      finish()
    }
    el.addEventListener('transitionend', onEnd)
    const fallback = window.setTimeout(finish, SPIN_MS + 120)

    return () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(fallback)
    }
  }, [spinning, locked, finalOffset, onStopped, value])

  return (
    <div
      className="relative flex-1 min-w-0"
      role="group"
      aria-label={ariaLabel}
      aria-busy={spinning && !locked}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-card to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-card to-transparent"
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-x-2 top-1/2 z-[1] h-[3px] -translate-y-1/2 rounded-full bg-primary/70 shadow-[0_0_12px_oklch(0.75_0.16_75/0.5)]',
        )}
        aria-hidden
      />
      <div className="relative h-16 overflow-hidden rounded-lg border-2 border-border bg-background/80 shadow-inner">
        <div ref={stripRef} className={cn(spinning && !locked && 'will-change-transform')}>
          {strip.map((item, i) => {
            const active =
              !spinning &&
              i === (SPIN_CYCLES - 1) * items.length + targetIndex
            return (
              <div
                key={`${item}-${i}`}
                className="flex h-16 items-center justify-center px-2"
                style={{ height: ITEM_HEIGHT }}
              >
                {renderItem(item, active)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export type SlotMachineTarget = {
  team: string
  decadeLabel: string
}

type SlotMachineProps = {
  teamOptions: readonly string[]
  decadeOptions: readonly string[]
  target: SlotMachineTarget
  spinning: boolean
  lockTeam?: boolean
  lockDecade?: boolean
  onComplete?: () => void
  renderTeam: (team: string, active: boolean) => ReactNode
  renderDecade: (label: string, active: boolean) => ReactNode
}

export function SlotMachine({
  teamOptions,
  decadeOptions,
  target,
  spinning,
  lockTeam = false,
  lockDecade = false,
  onComplete,
  renderTeam,
  renderDecade,
}: SlotMachineProps) {
  const [teamDone, setTeamDone] = useState(false)
  const [decadeDone, setDecadeDone] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!spinning) return
    setTeamDone(lockTeam)
    setDecadeDone(lockDecade)
    completedRef.current = false
  }, [spinning, lockTeam, lockDecade, target.team, target.decadeLabel])

  useEffect(() => {
    if (!spinning || completedRef.current) return
    if (teamDone && decadeDone) {
      completedRef.current = true
      onComplete?.()
    }
  }, [spinning, teamDone, decadeDone, onComplete])

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card to-background p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span className="text-primary">●</span>
          <span>Team</span>
          <span className="text-border">|</span>
          <span>Decade</span>
          <span className="text-primary">●</span>
        </div>
        <div className="flex gap-3">
          <SlotReel
            items={teamOptions}
            value={target.team}
            spinning={spinning}
            locked={lockTeam}
            onStopped={() => setTeamDone(true)}
            ariaLabel="Team reel"
            renderItem={renderTeam}
          />
          <SlotReel
            items={decadeOptions}
            value={target.decadeLabel}
            spinning={spinning}
            locked={lockDecade}
            onStopped={() => setDecadeDone(true)}
            ariaLabel="Decade reel"
            renderItem={renderDecade}
          />
        </div>
      </div>
      {spinning && (
        <p className="mt-3 text-center text-sm font-medium text-primary animate-pulse">
          Spinning…
        </p>
      )}
    </div>
  )
}
