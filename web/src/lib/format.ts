import type { Era } from '@/types'

/** Era label for cards — keeps the trailing "s" lowercase (avoid `uppercase` on parent). */
export function formatEraDisplay(era: Era): string {
  return era
}
