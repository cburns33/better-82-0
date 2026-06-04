import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

const ITEM_HEIGHT = 56
const SPIN_CYCLES = 6
const STRIP_BUFFER = 3
const STAGGER_S = 0.2
const BOUNCE_PX = 8

type SlotReelProps<T extends string> = {
  items: readonly T[]
  value: T
  spinning: boolean
  locked?: boolean
  delayS?: number
  onStopped?: () => void
  renderItem: (item: T, active: boolean) => ReactNode
  ariaLabel: string
}

function SlotReel<T extends string>({
  items,
  value,
  spinning,
  locked = false,
  delayS = 0,
  onStopped,
  renderItem,
  ariaLabel,
}: SlotReelProps<T>) {
  const stripRef = useRef<HTMLDivElement>(null)
  const stoppedRef = useRef(false)
  const lastOffsetRef = useRef(0)

  const targetIndex = Math.max(0, items.indexOf(value))

  const strip = useMemo(() => {
    const rows: T[] = []
    for (let c = 0; c < SPIN_CYCLES; c++) {
      for (const item of items) rows.push(item)
    }
    for (let i = 0; i < STRIP_BUFFER; i++) {
      rows.push(items[i % items.length]!)
    }
    return rows
  }, [items])

  const finalOffset = ((SPIN_CYCLES - 1) * items.length + targetIndex) * ITEM_HEIGHT
  const maxSpinOffset = finalOffset + BOUNCE_PX

  useGSAP(
    () => {
      stoppedRef.current = false
      const el = stripRef.current
      if (!el) return

      const finish = () => {
        if (stoppedRef.current) return
        stoppedRef.current = true
        onStopped?.()
      }

      const snap = (px: number) => {
        gsap.set(el, { y: -px, force3D: true })
      }

      if (!spinning) {
        snap(finalOffset)
        lastOffsetRef.current = finalOffset
        return
      }

      if (locked) {
        snap(finalOffset)
        lastOffsetRef.current = finalOffset
        finish()
        return
      }

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (reduced) {
        snap(finalOffset)
        lastOffsetRef.current = finalOffset
        finish()
        return
      }

      const itemCount = items.length
      const startIndex =
        itemCount > 0 ? Math.round(lastOffsetRef.current / ITEM_HEIGHT) % itemCount : 0
      const startOffset = startIndex * ITEM_HEIGHT

      snap(startOffset)

      const tl = gsap.timeline({
        delay: delayS,
        onComplete: () => {
          lastOffsetRef.current = finalOffset
          snap(finalOffset)
          finish()
        },
      })

      tl.to(el, { y: -(startOffset + 6), duration: 0.09, ease: 'power2.out' })
        .to(el, { y: -startOffset, duration: 0.06, ease: 'power2.in' })
        .to(el, { y: -maxSpinOffset, duration: 1.35, ease: 'power3.out' })
        .to(el, { y: -finalOffset, duration: 0.22, ease: 'back.out(1.6)' })

      return () => {
        gsap.killTweensOf(el)
      }
    },
    {
      scope: stripRef,
      dependencies: [spinning, locked, finalOffset, delayS, targetIndex, value],
      revertOnUpdate: false,
    },
  )

  return (
    <div
      className="relative flex-1 min-w-0"
      role="group"
      aria-label={ariaLabel}
      aria-busy={spinning && !locked}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-card to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-card to-transparent"
        aria-hidden
      />
      <div className="relative h-14 overflow-hidden rounded-md border border-border/80 bg-background/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]">
        <div
          ref={stripRef}
          className={cn('absolute inset-x-0 top-0', spinning && !locked && 'will-change-transform')}
        >
          {strip.map((item, i) => {
            const active =
              !spinning && i === (SPIN_CYCLES - 1) * items.length + targetIndex
            return (
              <div
                key={`${item}-${i}`}
                className="flex items-center justify-center bg-background/80 px-2"
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
    <div className="w-full">
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-card to-background p-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45),0_0_48px_-12px_oklch(0.75_0.16_75/0.15)]">
        <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span className="text-primary">●</span>
          <span>Team</span>
          <span className="text-border">|</span>
          <span>Decade</span>
          <span className="text-primary">●</span>
        </div>
        <div className="flex gap-2">
          <SlotReel
            items={teamOptions}
            value={target.team}
            spinning={spinning}
            locked={lockTeam}
            delayS={0}
            onStopped={() => setTeamDone(true)}
            ariaLabel="Team reel"
            renderItem={renderTeam}
          />
          <SlotReel
            items={decadeOptions}
            value={target.decadeLabel}
            spinning={spinning}
            locked={lockDecade}
            delayS={STAGGER_S}
            onStopped={() => setDecadeDone(true)}
            ariaLabel="Decade reel"
            renderItem={renderDecade}
          />
        </div>
      </div>
      <p
        className={cn(
          'overflow-hidden text-center text-sm font-medium text-primary transition-[max-height,opacity,margin] duration-300 ease-out',
          spinning ? 'mt-3 max-h-8 opacity-100 animate-pulse' : 'mt-0 max-h-0 opacity-0',
        )}
        aria-hidden={!spinning}
      >
        Spinning…
      </p>
    </div>
  )
}
