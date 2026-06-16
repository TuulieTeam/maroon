import { useEffect, useState } from 'react'
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

export function LiveMatchScreen({ result, startingLineups, onComplete }: LiveMatchScreenProps) {
  const playback = useMatchPlayback(result)
  const [halfTimeShown, setHalfTimeShown] = useState(false)
  const [halfTimeOpen, setHalfTimeOpen] = useState(false)
  const { pause } = playback

  // When the feed reaches the half-time siren for the first time, pause and pop the interstitial.
  useEffect(() => {
    if (!halfTimeShown && playback.current?.type === 'HALF_TIME') {
      pause()
      setHalfTimeOpen(true)
    }
  }, [playback.current, halfTimeShown, pause])

  const resumeFromHalfTime = () => {
    setHalfTimeOpen(false)
    setHalfTimeShown(true)
    playback.resume()
  }

  useEffect(() => {
    if (playback.done && playback.current?.type === 'FULL_TIME') {
      const t = window.setTimeout(onComplete, 1600)
      return () => window.clearTimeout(t)
    }
  }, [playback.done, playback.current, onComplete])

  return (
    <div className="app-shell">
      {halfTimeOpen && (
        <div className="halftime-overlay" role="dialog" aria-modal="true">
          <div className="halftime-modal">
            <BroadcastPanel slot="halfTime" segments={result.broadcast.halfTime} />
            <button className="btn-primary halftime-resume" onClick={resumeFromHalfTime}>
              Back to the match
            </button>
          </div>
        </div>
      )}

      <Scoreboard
        current={playback.current}
        tackleCount={deriveTackle(playback.revealed)}
        possession={derivePossession(playback.current)}
      />

      <div className="live-layout">
        <div className="live-controls">
          <div className="speed-group">
            <span className="label">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`speed-btn ${playback.speed === s ? 'active' : ''}`}
                onClick={() => playback.setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
          {playback.done ? (
            <button className="btn-primary" onClick={onComplete}>
              See the result
            </button>
          ) : (
            <button className="btn-ghost" onClick={playback.skipToEnd}>
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
