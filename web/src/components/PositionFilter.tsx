import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Position } from '@/types'
import { POSITIONS } from '@/types'

export type PositionFilterValue = Position | 'ALL'

interface Props {
  value: PositionFilterValue
  onChange: (value: PositionFilterValue) => void
  openPositions: Position[]
  compact?: boolean
}

export function PositionFilter({ value, onChange, openPositions, compact }: Props) {
  const openSet = new Set(openPositions)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto',
        compact ? 'pb-2 shrink-0' : 'flex-wrap gap-2 mb-3',
      )}
    >
      {!compact && (
        <span className="text-xs text-muted-foreground uppercase tracking-wide mr-1 shrink-0">
          Position
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant={value === 'ALL' ? 'default' : 'outline'}
        onClick={() => onChange('ALL')}
      >
        All
      </Button>
      {POSITIONS.map((pos) => (
        <Button
          key={pos}
          type="button"
          size="sm"
          variant={value === pos ? 'default' : 'outline'}
          onClick={() => onChange(pos)}
          className={cn('shrink-0', !openSet.has(pos) && value !== pos && 'opacity-50')}
          title={
            openSet.has(pos)
              ? `Can fill open ${pos}`
              : `${pos} filled — multi-position players may still apply`
          }
        >
          {pos}
        </Button>
      ))}
    </div>
  )
}
