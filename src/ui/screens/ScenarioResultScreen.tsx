import type { MatchResult } from '../../engine'
import { buildScenarioShareCard } from '../../scenarios'
import type { ScenarioDef } from '../../scenarios'
import type { FeatMint, NearMiss } from '../../feats'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { FeatToast } from '../components/FeatToast'
import { NearMissLines } from '../components/NearMissLines'
import { ShareCard } from '../components/ShareCard'
import { Wordmark } from '../components/Wordmark'
import './ResultScreen.css'
import './DailyScreens.css'

interface ScenarioResultScreenProps {
  result: MatchResult
  def: ScenarioDef
  /** Whether THIS run met the win condition (winning alone isn't always enough). */
  passed: boolean
  detail?: string
  /** Completed runs including this one. */
  attempts: number
  featMints?: FeatMint[]
  /** This run's quantifiable almost-theres — the "so close" tease under the toasts. */
  nearMisses?: NearMiss[]
  /** Replay the exact same pinned match — the learnable-puzzle loop. */
  onRunBack: () => void
  onContinue: () => void
}

/**
 * The scenario wrap. The verdict is keyed to the WIN CONDITION, not the scoreboard — winning the
 * game but missing the condition is its own heartbreak ("won, but not like that"), and that gap is
 * what makes a scenario more than a re-skinned match.
 */
export function ScenarioResultScreen({
  result,
  def,
  passed,
  detail,
  attempts,
  featMints = [],
  nearMisses = [],
  onRunBack,
  onContinue,
}: ScenarioResultScreenProps) {
  const won = result.winner === 'QLD'
  const verdict = passed ? 'CONDITION MET' : won ? 'WON — BUT NOT LIKE THAT' : 'SCENARIO FAILED'
  return (
    <div className="app-shell result-screen">
      <Wordmark sub="This Day in Origin" />
      <div className={`result-banner ${passed ? 'win' : 'loss'}`}>
        <h1 className="result-verdict">{verdict}</h1>
        <div className="result-final-score">
          {result.finalScore.qld} – {result.finalScore.nsw}
        </div>
        <div className="result-flavour">
          {passed
            ? detail ?? 'History answered. It goes in the ledger.'
            : won
              ? `The win came, the deed didn't: ${def.winLabel.toLowerCase().replace(/\.$/, '')}. Same match, run it back.`
              : 'The same match is waiting. Pick a different 19 and run it back.'}
        </div>
      </div>

      <div className="daily-wrap-meta">
        <span>🎯 {def.title}</span>
        <span>{def.winLabel}</span>
        <span>
          Attempt {attempts}
          {passed ? ' · conquered' : ''}
        </span>
      </div>

      {featMints.length > 0 && <FeatToast mints={featMints} />}
      <NearMissLines misses={nearMisses} />

      {result.iconicMoment && (
        <div className={`iconic-moment ${result.iconicMoment.side.toLowerCase()}`}>
          <div className="iconic-moment-label">⭐ The Moment · {result.iconicMoment.minute}′</div>
          <div className="iconic-moment-line">{result.iconicMoment.line}</div>
        </div>
      )}

      <div className="result-broadcast">
        <BroadcastPanel slot="postGame" segments={result.broadcast.postGame} />
      </div>

      <ShareCard text={buildScenarioShareCard(def, result.finalScore, result.winner, passed, detail)} />

      <div className="result-actions">
        {!passed && (
          <button className="btn-primary" onClick={onRunBack}>
            Run it back · same match
          </button>
        )}
        <button className={passed ? 'btn-primary' : 'btn-ghost'} onClick={onContinue}>
          Back to the hub
        </button>
      </div>
    </div>
  )
}
