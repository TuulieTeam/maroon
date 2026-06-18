import type { MatchResult } from '../../engine'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { GusSpeech } from '../components/GusSpeech'
import './PreGameScreen.css'

interface PreGameScreenProps {
  result: MatchResult
  gameLabel: string
  venueName: string
  /** The series stakes for this game (e.g. "Must win to survive") — surfaced so a decider doesn't feel like an opener. */
  stakesLabel: string
  onKickOff: () => void
}

export function PreGameScreen({ result, gameLabel, venueName, stakesLabel, onKickOff }: PreGameScreenProps) {
  return (
    <div className="app-shell pregame-screen">
      <header className="pregame-header">
        <p className="pregame-kicker">{gameLabel} · {venueName}</p>
        <h1 className="pregame-title">THE BUILD-UP</h1>
        <p className="pregame-sub">The desk has your team sheet. Hear them out, then send them out.</p>
        <div className="pregame-stakes">{stakesLabel}</div>
      </header>

      <BroadcastPanel slot="preGame" segments={result.broadcast.preGame} />

      <GusSpeech speech={result.broadcast.preMatchSpeech} />

      <div className="pregame-actions">
        <button className="btn-primary pregame-kickoff" onClick={onKickOff}>
          KICK OFF
        </button>
      </div>
    </div>
  )
}
