import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ResultLineup } from '@/components/ResultLineup'
import { ResultsBreakdown } from '@/components/ResultsBreakdown'
import { Button } from '@/components/ui/button'
import {
  buildShareUrl,
  clearShareHash,
  formatShareText,
} from '@/lib/shareRun'
import type { GameMode, Player, TeamResult } from '@/types'

type CopyKind = 'link' | 'text' | null

interface Props {
  mode: GameMode
  roster: readonly (Player | null)[]
  result: TeamResult
  /** Viewing someone else's shared link — hide share actions, show play CTA. */
  shared?: boolean
  onPlayAgain: () => void
}

export function ResultsScreen({
  mode,
  roster,
  result,
  shared = false,
  onPlayAgain,
}: Props) {
  const [copied, setCopied] = useState<CopyKind>(null)
  const filled = roster.filter((p): p is Player => p != null)

  const flashCopied = useCallback((kind: CopyKind) => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }, [])

  const shareUrl = buildShareUrl(mode, roster)
  const shareText = formatShareText(
    mode,
    roster,
    result.wins,
    result.losses,
    result.grade,
    result.label,
    result.teamOvr,
    shareUrl,
  )

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    flashCopied('link')
  }

  const copyText = async () => {
    await navigator.clipboard.writeText(shareText)
    flashCopied('text')
  }

  const nativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: `Better 82-0 — ${result.wins}–${result.losses}`,
        text: shareText,
        url: shareUrl,
      })
    } catch {
      /* user dismissed */
    }
  }

  const handlePlayAgain = () => {
    if (shared) clearShareHash()
    onPlayAgain()
  }

  return (
    <>
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {shared ? 'Shared lineup' : 'Your lineup'}
        </h1>
        {shared && (
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'classic' ? 'Classic' : 'HoopIQ'} mode
          </p>
        )}
      </header>

      <ResultLineup roster={roster} result={result} mode={mode} />

      {filled.length > 0 && mode === 'classic' && (
        <div className="mt-6">
          <ResultsBreakdown roster={filled} />
        </div>
      )}

      {!shared && (
        <div className="mt-6 space-y-2">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Share
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied === 'link' ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              {copied === 'link' ? 'Copied!' : 'Copy link'}
            </Button>
            <Button type="button" variant="outline" onClick={copyText}>
              {copied === 'text' ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied === 'text' ? 'Copied!' : 'Copy text'}
            </Button>
          </div>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button type="button" variant="secondary" className="w-full" onClick={nativeShare}>
              <Share2 className="size-4" aria-hidden />
              Share…
            </Button>
          )}
        </div>
      )}

      <Button size="lg" className="mt-8 w-full" onClick={handlePlayAgain}>
        {shared ? 'Play your own' : 'Play again'}
      </Button>
    </>
  )
}
