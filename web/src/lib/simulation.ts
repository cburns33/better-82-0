import type { GameMode, MetricKey, Player, TeamResult } from '../types'
import { METRIC_LABELS } from '../types'

const METRICS: MetricKey[] = ['ws48', 'vorp', 'obpm', 'dbpm', 'per']

/**
 * Classic mode: normalize the **lineup average** of each stat (five peak seasons).
 * Divisors ≈ strong MVP-level peak — so a team of five peaks approaches 110.
 * (Original 82-0 summed counting stats with divisors tuned for those totals;
 * summing WS/48/VORP/PER was blowing past 110 and auto-granting 82 wins.)
 */
const DIVISORS: Record<MetricKey, number> = {
  ws48: 0.22,
  vorp: 6,
  obpm: 5,
  dbpm: 2.5,
  per: 27,
}

const WEIGHTS: Record<MetricKey, number> = {
  ws48: 0.22,
  vorp: 0.28,
  obpm: 0.22,
  dbpm: 0.13,
  per: 0.15,
}

const ERA_PEAKS: Record<string, Record<MetricKey, number>> = {
  '1970s': { ws48: 0.2, vorp: 5.5, obpm: 5, dbpm: 3.5, per: 26 },
  '1980s': { ws48: 0.22, vorp: 6, obpm: 5.5, dbpm: 4, per: 27 },
  '1990s': { ws48: 0.24, vorp: 7, obpm: 6, dbpm: 4.5, per: 28 },
  '2000s': { ws48: 0.25, vorp: 7.5, obpm: 6.5, dbpm: 4.5, per: 29 },
  '2010s': { ws48: 0.27, vorp: 8, obpm: 7, dbpm: 5, per: 30 },
  '2020s': { ws48: 0.28, vorp: 8.5, obpm: 7.5, dbpm: 5, per: 31 },
}

/** Win curve from original 82-0: harder to stack wins at the top. */
const OVR_CAP = 110
const CLASSIC_EXPONENT = 1.15
const HOOPIQ_EXPONENT = 2.2
const HOOPIQ_GEOMEAN_MULT = 1.1

const WIN_TIERS = [
  { minWins: 80, grade: 'S', label: 'PERFECT', color: '#a855f7' },
  { minWins: 72, grade: 'A+', label: 'HISTORIC', color: '#22c55e' },
  { minWins: 62, grade: 'A', label: 'DYNASTY', color: '#22c55e' },
  { minWins: 57, grade: 'B', label: 'CONTENDER', color: '#3b82f6' },
  { minWins: 50, grade: 'C', label: 'PLAYOFF', color: '#f59e0b' },
  { minWins: 40, grade: 'D', label: 'LOTTERY', color: '#64748b' },
  { minWins: 0, grade: 'F', label: 'TANKING', color: '#ef4444' },
]

function normMetric(value: number, key: MetricKey, era: string, hoopIq: boolean): number {
  const peak = ERA_PEAKS[era]?.[key] ?? DIVISORS[key]
  let ratio = value / peak
  if (key === 'obpm' || key === 'dbpm') {
    ratio = (value + 2) / (peak + 2)
  }
  if (ratio > 1 && hoopIq) ratio = Math.pow(ratio, 1.25)
  return Math.max(0, ratio)
}

function normForClassic(avg: number, key: MetricKey): number {
  let ratio = avg / DIVISORS[key]
  if (key === 'obpm' || key === 'dbpm') {
    ratio = (avg + 2) / (DIVISORS[key] + 2)
  }
  return Math.max(0, ratio)
}

function metricValue(p: Player, key: MetricKey): number | null {
  const v = p[key]
  return v == null || Number.isNaN(v) ? null : v
}

function lineupAverage(roster: Player[], key: MetricKey): number | null {
  const values = roster
    .map((p) => metricValue(p, key))
    .filter((v): v is number => v != null)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function playerRating(p: Player, hoopIq: boolean): number {
  let score = 0
  let weightSum = 0
  for (const key of METRICS) {
    const v = metricValue(p, key)
    if (v == null) continue
    const w = WEIGHTS[key]
    score += w * normMetric(v, key, p.era, hoopIq)
    weightSum += w
  }
  if (weightSum === 0) return 50
  const scaled = score / weightSum
  const base = 60 + 40 * scaled
  const posBonus = (p.positions?.length ?? 1) - 1
  return Math.min(100, Math.round((base + posBonus * (hoopIq ? 3 : 2)) * 10) / 10)
}

function classicTeamOvr(roster: Player[]): number {
  let total = 0
  let weightSum = 0
  for (const key of METRICS) {
    const avg = lineupAverage(roster, key)
    if (avg == null) continue
    total += WEIGHTS[key] * normForClassic(avg, key)
    weightSum += WEIGHTS[key]
  }
  if (weightSum === 0) return 0
  const raw = (100 * total) / weightSum
  return Math.round(Math.min(raw, OVR_CAP) * 10) / 10
}

function projectedWins(teamOvr: number, exponent: number): number {
  return Math.round(82 * Math.pow(Math.min(teamOvr / OVR_CAP, 1), exponent))
}

export function calculateTeamResult(
  roster: readonly (Player | null)[],
  mode: GameMode,
): TeamResult {
  const filled = roster.filter((p): p is Player => p != null)
  const hoopIq = mode === 'hoopiq'

  if (filled.length === 0) {
    return { teamOvr: 0, wins: 0, losses: 82, grade: 'F', label: 'TANKING', color: '#ef4444' }
  }

  let teamOvr: number
  let exponent: number

  if (hoopIq) {
    const ratings = filled.map((p) => playerRating(p, true))
    const product = ratings.reduce((a, b) => a * Math.max(b, 1), 1)
    teamOvr =
      Math.round(
        HOOPIQ_GEOMEAN_MULT * Math.pow(product, 1 / ratings.length) * 10,
      ) / 10
    teamOvr = Math.min(teamOvr, OVR_CAP)
    exponent = HOOPIQ_EXPONENT
  } else {
    teamOvr = classicTeamOvr(filled)
    exponent = CLASSIC_EXPONENT
  }

  const wins = projectedWins(teamOvr, exponent)
  const tier = WIN_TIERS.find((t) => wins >= t.minWins) ?? WIN_TIERS[WIN_TIERS.length - 1]!

  return {
    teamOvr,
    wins,
    losses: 82 - wins,
    grade: tier.grade,
    label: tier.label,
    color: tier.color,
  }
}

export function formatMetric(key: MetricKey, value: number | null): string {
  if (value == null) return '—'
  if (key === 'ws48') return value.toFixed(3)
  if (key === 'per') return value.toFixed(1)
  return value.toFixed(1)
}

export interface MetricBreakdownRow {
  key: MetricKey
  label: string
  average: number | null
  /** MVP-level benchmark used in Classic OVR (same as DIVISORS). */
  benchmark: number
  /** normForClassic ratio — 1.0 ≈ elite peak average. */
  normalized: number
  weight: number
  /** Share of weighted normalized total (sums to 100 when all metrics present). */
  weightPct: number
}

export function getLineupMetricBreakdown(roster: readonly Player[]): MetricBreakdownRow[] {
  const rows: Omit<MetricBreakdownRow, 'weightPct'>[] = []

  for (const key of METRICS) {
    const avg = lineupAverage([...roster], key)
    const normalized = avg == null ? 0 : normForClassic(avg, key)
    rows.push({
      key,
      label: METRIC_LABELS[key],
      average: avg,
      benchmark: DIVISORS[key],
      normalized,
      weight: WEIGHTS[key],
    })
  }

  const weightSum = rows.reduce((sum, r) => sum + (r.average != null ? r.weight : 0), 0)
  return rows.map((r) => ({
    ...r,
    weightPct: weightSum > 0 && r.average != null ? (r.weight / weightSum) * 100 : 0,
  }))
}
