import { User } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { playerPhotoUrl, teamLogoUrl } from '@/lib/photos'
import { teamColors } from '@/lib/teams'
import { cn } from '@/lib/utils'

interface Props {
  team: string
  baseSlug: string
  size?: number
  className?: string
}

function avatarSurfaceStyle(primary: string): CSSProperties {
  return {
    backgroundColor: primary,
    backgroundImage: `linear-gradient(140deg, ${primary} 0%, ${primary} 58%, rgb(15 23 42) 100%)`,
    boxShadow: [
      `0 0 0 2px color-mix(in srgb, ${primary} 55%, white)`,
      `0 0 0 4px color-mix(in srgb, ${primary} 22%, transparent)`,
      `0 0 18px color-mix(in srgb, ${primary} 45%, transparent)`,
      'inset 0 1px 0 rgba(255, 255, 255, 0.18)',
    ].join(', '),
    isolation: 'isolate',
    contain: 'layout paint',
  }
}

export function PlayerAvatar({ team, baseSlug, size = 88, className }: Props) {
  const { bg } = teamColors(team)
  const logoUrl = teamLogoUrl(team)
  const photoUrl = playerPhotoUrl(baseSlug)
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    setPhotoFailed(false)
  }, [baseSlug, photoUrl])

  const showPhoto = Boolean(photoUrl) && !photoFailed

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full transition-[box-shadow,transform] duration-300',
        className,
      )}
      style={{ width: size, height: size, ...avatarSurfaceStyle(bg) }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="absolute inset-[6%] z-0 h-[88%] w-[88%] scale-[1.2] object-contain opacity-100"
          loading="lazy"
        />
      ) : null}
      {showPhoto ? (
        <div
          className="absolute left-0 top-0 z-[1] h-[120%] w-full"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        >
          <img
            src={photoUrl!}
            alt=""
            className="h-full w-full object-cover object-top outline outline-1 outline-black/10 dark:outline-white/10"
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 z-[1] flex items-end justify-center pb-[10%]"
          aria-hidden
        >
          <User className="h-[42%] w-[42%] text-white/30" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
