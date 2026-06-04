export type MetricKey = 'ws48' | 'vorp' | 'obpm' | 'dbpm' | 'per'

export type Era =
  | '1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | '2010s'
  | '2020s'

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export type GameMode = 'classic' | 'hoopiq'

export interface Player {
  id: string
  team: string
  player: string
  pos: Position
  positions: Position[]
  era: Era
  baseSlug: string
  ws48: number | null
  vorp: number | null
  obpm: number | null
  dbpm: number | null
  per: number | null
}

export interface TeamInfo {
  id: number
  abbreviation: string
  name: string
  decades: Partial<Record<Era, Player[]>>
}

export interface SlotResult {
  team: string
  era: Era
  decadeLabel: string
}

export interface TeamResult {
  teamOvr: number
  wins: number
  losses: number
  grade: string
  label: string
  color: string
}

export const DECADES: { label: string; era: Era }[] = [
  { label: "70's", era: '1970s' },
  { label: "80's", era: '1980s' },
  { label: "90's", era: '1990s' },
  { label: "00's", era: '2000s' },
  { label: "10's", era: '2010s' },
  { label: "20's", era: '2020s' },
]

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export const METRIC_LABELS: Record<MetricKey, string> = {
  ws48: 'WS/48',
  vorp: 'VORP',
  obpm: 'OBPM',
  dbpm: 'DBPM',
  per: 'PER',
}
