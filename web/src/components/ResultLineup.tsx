import { formatEraDisplay } from '@/lib/format'
import { formatMetric } from '@/lib/simulation'
import { cn } from '@/lib/utils'
import type { GameMode, Player, TeamResult } from '@/types'
import { POSITIONS } from '@/types'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Card } from '@/components/ui/card'

interface Props {
  roster: readonly (Player | null)[]
  result: TeamResult
  mode: GameMode
}

const RESULT_METRICS = ['ws48', 'vorp', 'per'] as const

export function ResultLineup({ roster, result, mode }: Props) {
  const hideStats = mode === 'hoopiq'

  return (
    <Card className="gap-0 overflow-hidden border-2 py-0 text-left" style={{ borderColor: result.color }}>
      <div className="border-b border-border/60 px-4 py-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Season complete
        </p>
        <p
          className="mt-2 text-5xl font-black tabular-nums tracking-tight sm:text-6xl"
          style={{ color: result.color }}
        >
          {result.wins}–{result.losses}
        </p>
        <p className="mt-2 text-lg font-bold uppercase tracking-wide" style={{ color: result.color }}>
          {result.grade} · {result.label}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Team strength{' '}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {result.teamOvr}
          </span>
        </p>
      </div>

      <ul className="divide-y divide-border/60">
        {POSITIONS.map((position, index) => {
          const player = roster[index]
          if (!player) return null

          return (
            <li
              key={player.id}
              className="grid grid-cols-[3.5rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[4rem_3.5rem_minmax(0,1fr)_auto] sm:px-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold tabular-nums text-muted-foreground normal-case">
                  {formatEraDisplay(player.era)}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">
                  {player.team} {position}
                </p>
              </div>

              <PlayerAvatar team={player.team} baseSlug={player.baseSlug} size={52} />

              <p className="text-balance text-base font-black uppercase leading-tight text-foreground sm:text-lg">
                {player.player}
              </p>

              {!hideStats ? (
                <div className="grid grid-cols-3 gap-2 text-right sm:gap-3">
                  {RESULT_METRICS.map((key) => (
                    <div key={key} className="min-w-[2.75rem]">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                        {key === 'ws48' ? 'WS/48' : key === 'vorp' ? 'VORP' : 'PER'}
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                        {formatMetric(key, player[key])}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {player.pos}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div
        className={cn(
          'grid border-t border-border/60 bg-muted/20 text-center',
          hideStats ? 'grid-cols-1' : 'grid-cols-3',
        )}
      >
        <div className="px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Record
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums" style={{ color: result.color }}>
            {result.wins}–{result.losses}
          </p>
        </div>
        {!hideStats && (
          <>
            <div className="border-x border-border/60 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Grade
              </p>
              <p className="mt-1 text-sm font-bold uppercase" style={{ color: result.color }}>
                {result.grade}
              </p>
            </div>
            <div className="px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                OVR
              </p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                {result.teamOvr}
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
