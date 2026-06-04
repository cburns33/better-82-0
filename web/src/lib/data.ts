import type { Era, Player, Position, SlotResult, TeamInfo } from '../types'
import { DECADES, POSITIONS } from '../types'
import rawPlayers from '../../../data/players_advanced.json'

export function loadPlayers(): Player[] {
  return (rawPlayers as Player[]).filter(
    (p) => p.ws48 != null || p.vorp != null || p.per != null,
  )
}

export function buildTeams(players: Player[]): TeamInfo[] {
  const byTeam = new Map<string, Map<Era, Player[]>>()

  for (const p of players) {
    if (!byTeam.has(p.team)) byTeam.set(p.team, new Map())
    const decades = byTeam.get(p.team)!
    if (!decades.has(p.era)) decades.set(p.era, [])
    decades.get(p.era)!.push(p)
  }

  return [...byTeam.entries()].map(([abbreviation, decadesMap], id) => {
    const decades: Partial<Record<Era, Player[]>> = {}
    for (const [era, list] of decadesMap) {
      decades[era] = list.sort((a, b) => a.player.localeCompare(b.player))
    }
    return { id, abbreviation, name: abbreviation, decades }
  })
}

export function canPlayPosition(player: Player, position: Position): boolean {
  const positions = player.positions?.filter((x) => x && String(x) !== 'nan') ?? []
  if (positions.includes(position)) return true
  return player.pos === position
}

/** Open roster slots (position + index into the five-slot lineup). */
export function getOpenSlots(
  roster: readonly (Player | null)[],
): { position: Position; index: number }[] {
  return POSITIONS.map((position, index) => ({ position, index })).filter(
    ({ index }) => roster[index] == null,
  )
}

export function getEligibleSlots(
  player: Player,
  roster: readonly (Player | null)[],
): { position: Position; index: number }[] {
  return getOpenSlots(roster).filter(({ position }) => canPlayPosition(player, position))
}

export function getPool(
  teams: TeamInfo[],
  teamAbbr: string,
  era: Era,
  roster: readonly (Player | null)[],
  usedIds: Set<string>,
): Player[] {
  const openSlots = getOpenSlots(roster)
  if (openSlots.length === 0) return []

  const team = teams.find((t) => t.abbreviation === teamAbbr)
  const list = team?.decades[era] ?? []
  return list.filter(
    (p) => !usedIds.has(p.id) && getEligibleSlots(p, roster).length > 0,
  )
}

export function filterPoolByPosition(
  players: Player[],
  position: Position | null,
): Player[] {
  if (position == null) return players
  return players.filter((p) => canPlayPosition(p, position))
}

export type SpinResolveOptions = {
  keepTeam?: boolean
  keepDecade?: boolean
  /** Do not pick this team (skip team). */
  excludeTeam?: string
  /** Do not pick this era (skip decade). */
  excludeEra?: Era
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** Pick team + decade where at least one player can fill an open roster slot. */
export function resolveValidSlot(
  teams: TeamInfo[],
  teamList: readonly string[],
  roster: readonly (Player | null)[],
  usedIds: Set<string>,
  usedEras: Set<Era>,
  opts: SpinResolveOptions = {},
  currentSlot: SlotResult | null = null,
): SlotResult {
  const collect = (allowUsedEras: boolean): SlotResult[] => {
    const out: SlotResult[] = []
    const teamsToTry =
      opts.keepTeam && currentSlot
        ? [currentSlot.team]
        : teamList.filter((t) => t !== opts.excludeTeam)

    for (const team of teamsToTry) {
      for (const { era, label } of DECADES) {
        if (opts.keepDecade && currentSlot && era !== currentSlot.era) continue
        if (opts.excludeEra && era === opts.excludeEra) continue
        if (!allowUsedEras && usedEras.has(era)) continue
        if (getPool(teams, team, era, roster, usedIds).length > 0) {
          out.push({ team, era, decadeLabel: label })
        }
      }
    }
    return out
  }

  let candidates = collect(false)
  if (candidates.length === 0) candidates = collect(true)

  if (candidates.length > 0) return randomFrom(candidates)

  // Last resort: any team/era with players in data (may still filter to 0 in UI for tight positions).
  for (const team of teamList) {
    if (opts.excludeTeam && team === opts.excludeTeam) continue
    for (const { era, label } of DECADES) {
      if (opts.excludeEra && era === opts.excludeEra) continue
      const list = teams.find((t) => t.abbreviation === team)?.decades[era] ?? []
      if (list.some((p) => !usedIds.has(p.id))) {
        return { team, era, decadeLabel: label }
      }
    }
  }

  return {
    team: randomFrom([...teamList]),
    era: randomFrom(DECADES.map((d) => d.era)),
    decadeLabel: DECADES[0]!.label,
  }
}
