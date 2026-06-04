import { formatMetric, getLineupMetricBreakdown } from '@/lib/simulation'
import { cn } from '@/lib/utils'
import type { Player } from '@/types'

function barColor(normalized: number): string {
  if (normalized >= 1) return 'bg-primary'
  if (normalized >= 0.75) return 'bg-emerald-500'
  if (normalized >= 0.5) return 'bg-amber-500'
  return 'bg-muted-foreground/50'
}

interface Props {
  roster: readonly Player[]
}

export function ResultsBreakdown({ roster }: Props) {
  const rows = getLineupMetricBreakdown(roster)

  return (
    <section className="rounded-xl border border-border/60 bg-card/30 p-4">
      <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Stat breakdown
      </p>
      <p className="mb-4 text-center text-[11px] text-muted-foreground">
        Lineup averages vs MVP-level benchmarks · bar fill = strength
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const fillPct = Math.min(row.normalized * 100, 100)
          return (
            <li key={row.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">{row.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatMetric(row.key, row.average)}
                  <span className="text-[10px]">
                    {' '}
                    / {formatMetric(row.key, row.benchmark)}
                  </span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-secondary/80">
                <div
                  className={cn('absolute inset-y-0 left-0 rounded-full transition-[width]', barColor(row.normalized))}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                {Math.round(row.normalized * 100)}% of benchmark
                {row.weightPct > 0 && ` · ${row.weightPct.toFixed(0)}% of OVR weight`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
