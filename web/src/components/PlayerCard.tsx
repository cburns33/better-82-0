import { ChevronRight } from 'lucide-react'
import { formatEraDisplay } from '@/lib/format'
import { formatMetric } from '@/lib/simulation'
import { teamColors } from '@/lib/teams'
import { cn } from '@/lib/utils'
import type { GameMode, MetricKey, Player, Position } from '@/types'
import { METRIC_LABELS } from '@/types'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const METRIC_KEYS: MetricKey[] = ['ws48', 'vorp', 'obpm', 'dbpm', 'per']

interface Props {
  player: Player
  mode: GameMode
  eligiblePositions?: Position[]
  onSelect?: () => void
  selected?: boolean
  density?: 'default' | 'compact' | 'grid'
}

export function PlayerCard({
  player,
  mode,
  eligiblePositions,
  onSelect,
  selected,
  density = 'default',
}: Props) {
  const colors = teamColors(player.team)
  const hideStats = mode === 'hoopiq'
  const interactive = Boolean(onSelect)
  const compact = density === 'compact'
  const grid = density === 'grid'

  const fitsLabel = eligiblePositions?.length
    ? eligiblePositions.join(', ')
    : player.pos

  const statsLine = METRIC_KEYS.map((key) => formatMetric(key, player[key])).join(' · ')

  const content = grid ? (
    <Card
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-card text-card-foreground transition-[box-shadow,transform,border-color] duration-200',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:bg-muted/40 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35)]',
        selected &&
          'border-primary/60 shadow-[0_0_0_1px_oklch(0.75_0.16_75/0.4),0_12px_32px_-8px_rgba(0,0,0,0.45)]',
      )}
    >
      <div className="grid min-h-[132px] grid-cols-[112px_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-r border-border/60 bg-card p-3 transition-[background-color] duration-200 group-hover:bg-muted/60">
          <PlayerAvatar team={player.team} baseSlug={player.baseSlug} />
        </div>
        <div className="flex min-w-0 flex-col justify-center p-3">
          <p className="text-sm font-black tracking-wide text-muted-foreground tabular-nums normal-case">
            {formatEraDisplay(player.era)}
          </p>
          <p className="mt-1 text-balance text-lg font-black leading-[1.05] text-foreground">
            {player.player}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
            <span>{player.team}</span>
            <Badge
              variant="outline"
              className="rounded-md border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
            >
              {fitsLabel}
            </Badge>
          </div>
          {!hideStats && (
            <p className="mt-2 truncate font-mono text-[10px] tabular-nums text-muted-foreground">
              {statsLine}
            </p>
          )}
        </div>
      </div>
      {interactive && (
        <div className="mt-auto flex items-center justify-between border-t border-border/60 bg-background/30 px-3 py-2.5 transition-[background-color,color] duration-200 group-hover:bg-primary/10">
          <span className="text-xs font-black uppercase tracking-[0.08em] text-foreground transition-colors duration-200 group-hover:text-primary">
            Pick player
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      )}
    </Card>
  ) : (
    <Card
      className={cn(
        'relative overflow-hidden border-border/80 transition-[box-shadow,transform,border-color] duration-200',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35)]',
        compact && interactive && 'hover:translate-y-0 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)]',
        selected &&
          'border-primary/60 shadow-[0_0_0_1px_oklch(0.75_0.16_75/0.4),0_12px_32px_-8px_rgba(0,0,0,0.45)]',
        compact &&
          selected &&
          'shadow-[0_0_0_1px_oklch(0.75_0.16_75/0.4),0_6px_16px_-6px_rgba(0,0,0,0.45)]',
      )}
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: colors.bg }}
        aria-hidden
      />
      {!compact && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 55%)` }}
          aria-hidden
        />
      )}
      <CardContent className={cn('relative', compact ? 'py-2 pl-3.5 pr-3' : 'p-4 pl-5')}>
        {compact ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="truncate text-sm font-semibold leading-tight">{player.player}</p>
                {!hideStats && (
                  <p className="hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground sm:block">
                    {statsLine}
                  </p>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {fitsLabel} · {player.era}
              </p>
              {!hideStats && (
                <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-muted-foreground sm:hidden">
                  {statsLine}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className="h-5 shrink-0 border-0 px-1.5 py-0 text-[10px] font-bold"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {player.team}
            </Badge>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{player.player}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {eligiblePositions?.length ? `Fits: ${fitsLabel}` : `${player.pos} · ${player.era}`}
                  {eligiblePositions?.length ? ` · ${player.era}` : ''}
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-0 font-bold"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {player.team}
              </Badge>
            </div>
            {!hideStats && (
              <dl className="mt-3 grid grid-cols-5 gap-1 border-t border-border/60 pt-3 text-center">
                {METRIC_KEYS.map((key) => (
                  <div key={key}>
                    <dt className="text-[10px] font-medium text-muted-foreground">
                      {METRIC_LABELS[key]}
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm tabular-nums">
                      {formatMetric(key, player[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )

  if (!interactive) return content

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left transition-transform duration-200 active:scale-[0.96]"
    >
      {content}
    </button>
  )
}
