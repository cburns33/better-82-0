import type { GameMode, Player } from '@/types'
import { POSITIONS } from '@/types'

const SHARE_PREFIX = 'share='

export interface SharedRun {
  mode: GameMode
  roster: (Player | null)[]
}

function modeCode(mode: GameMode): string {
  return mode === 'classic' ? 'c' : 'h'
}

function modeFromCode(code: string): GameMode | null {
  if (code === 'c') return 'classic'
  if (code === 'h') return 'hoopiq'
  return null
}

/** Encode lineup as slot-index:playerId pairs (0=PG … 4=C). */
export function encodeSharedRun(mode: GameMode, roster: readonly (Player | null)[]): string {
  const picks = POSITIONS.map((_, i) => {
    const p = roster[i]
    return p ? `${i}:${p.id}` : null
  }).filter((x): x is string => x != null)

  return `${SHARE_PREFIX}m=${modeCode(mode)}&p=${picks.join(',')}`
}

export function decodeSharedRun(
  hash: string,
  playerById: Map<string, Player>,
): SharedRun | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(SHARE_PREFIX)) return null

  const params = new URLSearchParams(raw.slice(SHARE_PREFIX.length))
  const mode = modeFromCode(params.get('m') ?? '')
  const picks = params.get('p')
  if (!mode || !picks) return null

  const roster: (Player | null)[] = Array(POSITIONS.length).fill(null)
  let validCount = 0

  for (const part of picks.split(',')) {
    const [slotStr, id] = part.split(':')
    const slot = Number(slotStr)
    if (!id || !Number.isInteger(slot) || slot < 0 || slot >= POSITIONS.length) continue
    const player = playerById.get(id)
    if (!player) continue
    roster[slot] = player
    validCount++
  }

  if (validCount !== POSITIONS.length) return null
  return { mode, roster }
}

export function buildShareUrl(mode: GameMode, roster: readonly (Player | null)[]): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#${encodeSharedRun(mode, roster)}`
}

export function formatShareText(
  mode: GameMode,
  roster: readonly (Player | null)[],
  wins: number,
  losses: number,
  grade: string,
  label: string,
  teamOvr: number,
  shareUrl: string,
): string {
  const modeLabel = mode === 'classic' ? 'Classic' : 'HoopIQ'
  const lines = [
    `Better 82-0 — ${wins}–${losses} (${grade} · ${label})`,
    `${modeLabel} · Team OVR ${teamOvr}`,
    '',
    ...POSITIONS.map((pos, i) => {
      const p = roster[i]
      if (!p) return `${pos} —`
      return `${pos} ${p.player} (${p.team} · ${p.era})`
    }),
    '',
    shareUrl,
  ]
  return lines.join('\n')
}

export function parseShareFromLocation(
  playerById: Map<string, Player>,
): SharedRun | null {
  return decodeSharedRun(window.location.hash, playerById)
}

export function clearShareHash(): void {
  if (window.location.hash.includes(SHARE_PREFIX)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
