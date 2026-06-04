import { formatMetric } from '@/lib/simulation'
import { teamColors } from '@/lib/teams'
import { cn } from '@/lib/utils'
import type { GameMode, MetricKey, Player, Position } from '@/types'
import { METRIC_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const METRIC_KEYS: MetricKey[] = ['ws48', 'vorp', 'obpm', 'dbpm', 'per']

interface Props {
  player: Player
  mode: GameMode
  eligiblePositions?: Position[]
  onSelect?: () => void
  selected?: boolean
  density?: 'default' | 'compact'
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

  const fitsLabel = eligiblePositions?.length
    ? eligiblePositions.join(', ')
    : player.pos

  const statsLine = METRIC_KEYS.map((key) => formatMetric(key, player[key])).join(' · ')

  const content = (
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
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{player.player}</p>
                {!hideStats && (
                  <p className="hidden sm:block shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
                    {statsLine}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {fitsLabel} · {player.era}
              </p>
              {!hideStats && (
                <p className="sm:hidden text-[10px] font-mono tabular-nums text-muted-foreground truncate mt-0.5">
                  {statsLine}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className="shrink-0 border-0 font-bold text-[10px] px-1.5 py-0 h-5"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {player.team}
            </Badge>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-tight truncate">{player.player}</p>
                <p className="text-xs text-muted-foreground mt-1">
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
              <dl className="mt-3 grid grid-cols-5 gap-1 text-center border-t border-border/60 pt-3">
                {METRIC_KEYS.map((key) => (
                  <div key={key}>
                    <dt className="text-[10px] text-muted-foreground font-medium">{METRIC_LABELS[key]}</dt>
                    <dd className="text-sm font-mono tabular-nums mt-0.5">
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
    <button type="button" onClick={onSelect} className="w-full text-left">
      {content}
    </button>
  )
}
