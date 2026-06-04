import { formatMetric } from '../lib/simulation'
import { teamColors } from '../lib/teams'
import type { GameMode, MetricKey, Player, Position } from '../types'
import { METRIC_LABELS } from '../types'

const METRIC_KEYS: MetricKey[] = ['ws48', 'vorp', 'obpm', 'dbpm', 'per']

interface Props {
  player: Player
  mode: GameMode
  /** Slots this pick can fill (open positions they qualify for). */
  eligiblePositions?: Position[]
  onSelect?: () => void
  selected?: boolean
}

export function PlayerCard({ player, mode, eligiblePositions, onSelect, selected }: Props) {
  const colors = teamColors(player.team)
  const hideStats = mode === 'hoopiq'

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        onSelect ? 'cursor-pointer hover:border-amber-400/60 hover:bg-white/5' : ''
      } ${selected ? 'border-amber-400 bg-amber-400/10' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{player.player}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {eligiblePositions?.length
              ? `Can play: ${eligiblePositions.join(', ')}`
              : player.pos}{' '}
            · {player.era}
          </p>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {player.team}
        </span>
      </div>
      {!hideStats && (
        <dl className="mt-2 grid grid-cols-5 gap-1 text-center">
          {METRIC_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-[10px] text-[var(--color-muted)]">{METRIC_LABELS[key]}</dt>
              <dd className="text-sm font-mono tabular-nums">{formatMetric(key, player[key])}</dd>
            </div>
          ))}
        </dl>
      )}
    </button>
  )
}
