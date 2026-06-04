import type { Position } from '../types'
import { POSITIONS } from '../types'

export type PositionFilterValue = Position | 'ALL'

interface Props {
  value: PositionFilterValue
  onChange: (value: PositionFilterValue) => void
  /** Open lineup spots — used to highlight which filters are still relevant. */
  openPositions: Position[]
}

export function PositionFilter({ value, onChange, openPositions }: Props) {
  const openSet = new Set(openPositions)

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Position</span>
      <button
        type="button"
        onClick={() => onChange('ALL')}
        className={chipClass(value === 'ALL')}
      >
        All
      </button>
      {POSITIONS.map((pos) => {
        const isOpen = openSet.has(pos)
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onChange(pos)}
            className={chipClass(value === pos, isOpen)}
            title={isOpen ? `Can fill open ${pos}` : `${pos} filled — still shows multi-position players`}
          >
            {pos}
          </button>
        )
      })}
    </div>
  )
}

function chipClass(active: boolean, isOpen = true): string {
  const base =
    'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors'
  if (active) {
    return `${base} border-amber-400 bg-amber-400/15 text-amber-300`
  }
  if (!isOpen) {
    return `${base} border-[var(--color-border)]/50 text-[var(--color-muted)]/60 hover:border-[var(--color-border)]`
  }
  return `${base} border-[var(--color-border)] text-[var(--color-muted)] hover:border-amber-400/40 hover:text-white`
}
