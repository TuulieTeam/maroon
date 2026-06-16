import type { MatchResult } from '../../engine'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { GusSpeech } from '../components/GusSpeech'
import './PreGameScreen.css'

interface PreGameScreenProps {
  result: MatchResult
  gameLabel: string
  venueName: string
  onKickOff: () => void
}

export function PreGameScreen({ result, gameLabel, venueName, onKickOff }: PreGameScreenProps) {
  return (
    <div className="app-shell pregame-screen">
      <header className="pregame-header">
        <div className="pregame-kicker">{gameLabel} · {venueName}</div>
        <div className="pregame-title">THE BUILD-UP</div>
        <div className="pregame-sub">The desk has your team sheet. Hear them out, then send them out.</div>
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
