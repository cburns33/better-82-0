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
}

export function PlayerCard({ player, mode, eligiblePositions, onSelect, selected }: Props) {
  const colors = teamColors(player.team)
  const hideStats = mode === 'hoopiq'
  const interactive = Boolean(onSelect)

  const content = (
    <Card
      className={cn(
        'transition-colors',
        interactive && 'cursor-pointer hover:border-primary/50 hover:bg-accent/30',
        selected && 'border-primary bg-primary/5',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{player.player}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {eligiblePositions?.length
                ? `Fits: ${eligiblePositions.join(', ')}`
                : player.pos}{' '}
              · {player.era}
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
          <dl className="mt-3 grid grid-cols-5 gap-1 text-center border-t border-border pt-3">
            {METRIC_KEYS.map((key) => (
              <div key={key}>
                <dt className="text-[10px] text-muted-foreground font-medium">{METRIC_LABELS[key]}</dt>
                <dd className="text-sm font-mono tabular-nums mt-0.5">{formatMetric(key, player[key])}</dd>
              </div>
            ))}
          </dl>
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
