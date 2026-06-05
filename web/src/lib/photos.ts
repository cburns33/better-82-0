import photoMap from '../../../data/player_photos.json'
import { TEAM_NBA_IDS } from '@/lib/teams'

export interface PlayerPhotoEntry {
  nbaId: number | null
  bbrefId?: string | null
  player: string
  photoUrl: string | null
  source?: string | null
}

const photos = photoMap as Record<string, PlayerPhotoEntry>

/** NBA CDN headshot (260×190). Returns null when no mapped ID exists. */
export function playerPhotoUrl(baseSlug: string): string | null {
  return photos[baseSlug]?.photoUrl ?? null
}

export function playerNbaId(baseSlug: string): number | null {
  return photos[baseSlug]?.nbaId ?? null
}

export function hasPlayerPhoto(baseSlug: string): boolean {
  return baseSlug in photos
}

/** Same-origin team logo SVG (`/img/team-logos/{nbaTeamId}.svg`). */
export function teamLogoUrl(teamAbbr: string): string | null {
  const id = TEAM_NBA_IDS[teamAbbr]
  if (id == null) return null
  return `/img/team-logos/${id}.svg`
}
