import type { GameMode, Player } from '../types'

function metricSortKey(p: Player): number {
  return (
    (p.ws48 ?? 0) +
    (p.vorp ?? 0) +
    (p.obpm ?? 0) +
    (p.dbpm ?? 0) +
    (p.per ?? 0) / 10
  )
}

/** Classic: best metrics first. HoopIQ: alphabetical (no stat sorting). */
export function sortPlayerPool(players: Player[], mode: GameMode): Player[] {
  const copy = [...players]
  if (mode === 'hoopiq') {
    return copy.sort((a, b) => a.player.localeCompare(b.player, undefined, { sensitivity: 'base' }))
  }
  return copy.sort((a, b) => metricSortKey(b) - metricSortKey(a))
}
