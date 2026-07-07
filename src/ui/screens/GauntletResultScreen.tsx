import type { MatchResult } from '../../engine'
import { buildGauntletShareCard } from '../../daily'
import type { DailyChallenge } from '../../daily'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { ShareCard } from '../components/ShareCard'
import { Wordmark } from '../components/Wordmark'
import './ResultScreen.css'
import './DailyScreens.css'

interface GauntletResultScreenProps {
  result: MatchResult
  challenge: DailyChallenge
  onContinue: () => void
}

/**
 * The Gauntlet's wrap — deliberately lean. No ledger, no streak: the share card IS the scoreboard,
 * and it carries the link so the chain keeps going. Your mate's margin vs yours settles it in the
 * group chat, where it belongs.
 */
export function GauntletResultScreen({ result, challenge, onContinue }: GauntletResultScreenProps) {
  const won = result.winner === 'QLD'
  const drew = result.winner === 'DRAW'
  return (
    <div className="app-shell result-screen">
      <Wordmark sub="The Gauntlet" />
      <div className={`result-banner ${won ? 'win' : drew ? 'draw' : 'loss'}`}>
        <h1 className="result-verdict">{won ? 'GAUNTLET ANSWERED' : drew ? 'HONOURS EVEN' : 'GAUNTLET DROPPED'}</h1>
        <div className="result-final-score">
          {result.finalScore.qld} – {result.finalScore.nsw}
        </div>
        <div className="result-flavour">Same match as your mate. Compare margins and settle it.</div>
      </div>

      <div className="daily-wrap-meta">
        <span>⚔️ Gauntlet #{challenge.seed}</span>
        <span>⚡ {challenge.twist.label}</span>
      </div>

      {result.iconicMoment && (
        <div className={`iconic-moment ${result.iconicMoment.side.toLowerCase()}`}>
          <div className="iconic-moment-label">⭐ The Moment · {result.iconicMoment.minute}′</div>
          <div className="iconic-moment-line">{result.iconicMoment.line}</div>
        </div>
      )}

      <div className="result-broadcast">
        <BroadcastPanel slot="postGame" segments={result.broadcast.postGame} />
      </div>

      <ShareCard text={buildGauntletShareCard(challenge, result.finalScore, result.winner)} />

      <div className="result-actions">
        <button className="btn-primary" onClick={onContinue}>
          Back to your game
        </button>
      </div>
    </div>
  )
}
