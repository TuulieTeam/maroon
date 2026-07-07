import { useCallback, useEffect, useRef, useState } from 'react'
import type { Player, Position } from '../../data/types'
import type { MatchEvent, MatchResult, Side } from '../../engine'
import { Scoreboard } from '../components/Scoreboard'
import { CommentaryFeed } from '../components/CommentaryFeed'
import { ActiveTeamPanel } from '../components/ActiveTeamPanel'
import { LiveStatsPanel } from '../components/LiveStatsPanel'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { useMatchPlayback } from '../hooks/useMatchPlayback'
import type { PlaybackSpeed } from '../hooks/useMatchPlayback'
import './LiveMatchScreen.css'

interface LiveMatchScreenProps {
  result: MatchResult
  /** Match identity + stakes echoed from the hub so the tension carries into the broadcast. */
  gameLabel: string
  venueName: string
  stakesLabel: string
  startingLineups: Record<Side, Record<Position, Player>>
  onComplete: () => void
}

const POSSESSION_RESET = new Set(['TRY', 'CONVERSION', 'TURNOVER_DOWNTOWN', 'ERROR', 'PENALTY', 'HALF_TIME', 'KICKOFF'])

function deriveTackle(revealed: MatchEvent[]): number {
  let tackle = 0
  for (let i = revealed.length - 1; i >= 0; i--) {
    const e = revealed[i]
    if (POSSESSION_RESET.has(e.type) || e.type === 'KICK') return tackle
    if (e.type === 'HIT_UP' || e.type === 'TACKLE' || e.type === 'MISSED_TACKLE' || e.type === 'OFFLOAD' || e.type === 'LINE_BREAK' || e.type === 'HALF_BREAK') {
      tackle += 1
    }
  }
  return tackle
}

function derivePossession(current: MatchEvent | null): 'QLD' | 'NSW' | null {
  if (!current) return null
  if (current.type === 'HALF_TIME' || current.type === 'FULL_TIME' || current.type === 'KICKOFF') return null
  return current.side
}

const SPEEDS: PlaybackSpeed[] = [1, 2, 4]

export function LiveMatchScreen({
  result,
  gameLabel,
  venueName,
  stakesLabel,
  startingLineups,
  onComplete,
}: LiveMatchScreenProps) {
  const playback = useMatchPlayback(result)
  const [halfTimeShown, setHalfTimeShown] = useState(false)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const { pause, resume } = playback

  // playback.current is the latest revealed event — plain derived state, not a mutable ref, so
  // alias it before it lands in any dependency array.
  const currentEvent = playback.current

  // The interstitial is open from the moment the feed reaches the half-time siren until the user
  // dismisses it; the ticker is paused behind it.
  const halfTimeOpen = !halfTimeShown && currentEvent?.type === 'HALF_TIME'

  useEffect(() => {
    if (halfTimeOpen) pause()
  }, [halfTimeOpen, pause])

  const resumeFromHalfTime = useCallback(() => {
    setHalfTimeShown(true)
    resume()
  }, [resume])

  // Move focus into the half-time dialog on open, and let Escape resume — basic modal hygiene so a
  // keyboard/AT user isn't stranded in the now-hidden feed behind it.
  useEffect(() => {
    if (!halfTimeOpen) return
    resumeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resumeFromHalfTime()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [halfTimeOpen, resumeFromHalfTime])

  useEffect(() => {
    if (playback.done && currentEvent?.type === 'FULL_TIME') {
      const t = window.setTimeout(onComplete, 1600)
      return () => window.clearTimeout(t)
    }
  }, [playback.done, currentEvent, onComplete])

  return (
    <div className="app-shell">
      {halfTimeOpen && (
        <div className="halftime-overlay" role="dialog" aria-modal="true" aria-label="Half time">
          <div className="halftime-modal">
            <BroadcastPanel slot="halfTime" segments={result.broadcast.halfTime} />
            <button ref={resumeRef} type="button" className="btn-primary halftime-resume" onClick={resumeFromHalfTime}>
              Back to the match
            </button>
          </div>
        </div>
      )}

      <div className="live-strip">
        <span className={`live-pill ${playback.done ? 'is-fulltime' : ''}`}>
          {playback.done ? 'FULL TIME' : 'LIVE'}
        </span>
        <span className="live-kicker">{gameLabel} · {venueName}</span>
        <span className="live-stakes">{stakesLabel}</span>
      </div>

      <Scoreboard
        current={playback.current}
        tackleCount={deriveTackle(playback.revealed)}
        possession={derivePossession(playback.current)}
      />

      <div className="live-layout">
        <div className="live-controls">
          <div className="speed-group" role="group" aria-label="Playback speed">
            <span className="label">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-btn ${playback.speed === s ? 'active' : ''}`}
                aria-pressed={playback.speed === s}
                onClick={() => playback.setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
          {playback.done ? (
            <button type="button" className="btn-primary" onClick={onComplete}>
              See the result
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={playback.skipToEnd}>
              Skip to full time
            </button>
          )}
        </div>

        <div className="live-main">
          <CommentaryFeed events={playback.revealed} />
          <aside className="live-side">
            <LiveStatsPanel revealed={playback.revealed} />
            <ActiveTeamPanel revealed={playback.revealed} startingLineups={startingLineups} />
          </aside>
        </div>
      </div>
    </div>
  )
}
