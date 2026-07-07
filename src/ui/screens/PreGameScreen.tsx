import type { BackPage } from '../../coach'
import type { MatchResult } from '../../engine'
import { BackPagePanel } from '../components/BackPagePanel'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { GusSpeech } from '../components/GusSpeech'
import { Wordmark } from '../components/Wordmark'
import './PreGameScreen.css'

interface PreGameScreenProps {
  result: MatchResult
  gameLabel: string
  venueName: string
  /** The series stakes for this game (e.g. "Must win to survive") — surfaced so a decider doesn't feel like an opener. */
  stakesLabel: string
  /** The morning paper's position on the coach's boldest selection call (series games only). */
  backPage?: BackPage | null
  onKickOff: () => void
}

export function PreGameScreen({ result, gameLabel, venueName, stakesLabel, backPage, onKickOff }: PreGameScreenProps) {
  return (
    <div className="app-shell pregame-screen">
      <Wordmark sub={gameLabel} />
      <header className="pregame-header">
        <p className="pregame-kicker">{gameLabel} · {venueName}</p>
        <h1 className="pregame-title">THE BUILD-UP</h1>
        <p className="pregame-sub">The desk has your team sheet. Hear them out, then send them out.</p>
        <div className="pregame-stakes">{stakesLabel}</div>
      </header>

      {backPage && <BackPagePanel page={backPage} />}

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
