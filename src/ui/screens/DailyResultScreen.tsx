import type { MatchResult } from '../../engine'
import { buildDailyShareCard, buildGauntletShareCard, challengeFromSeed, dailySeed, formatDateKey, twistById } from '../../daily'
import type { DailyRecord, DailySummary } from '../../daily'
import type { FeatMint } from '../../feats'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { FeatToast } from '../components/FeatToast'
import { ShareCard } from '../components/ShareCard'
import { Wordmark } from '../components/Wordmark'
import './ResultScreen.css'
import './DailyScreens.css'

interface DailyResultScreenProps {
  result: MatchResult
  /** Today's ledger record (already folded in when this screen shows). */
  record: DailyRecord
  /** Streak read AFTER today's result — the number this screen exists to reveal. */
  summary: DailySummary
  /** Feats earned by this daily — the toast moment; first earns also land on the share card. */
  featMints?: FeatMint[]
  onContinue: () => void
}

function verdict(result: MatchResult): { cls: string; text: string; flavour: string } {
  if (result.winner === 'QLD') {
    return {
      cls: 'win',
      text: 'DAILY WON',
      flavour: 'One attempt, taken. The streak lives another day.',
    }
  }
  if (result.winner === 'NSW') {
    return {
      cls: 'loss',
      text: 'DAILY LOST',
      flavour: 'That was your one shot at today. Tomorrow is a new draw.',
    }
  }
  return { cls: 'draw', text: 'A STALEMATE', flavour: 'No winner in the Daily — and the streak needs wins.' }
}

/** The streak headline: the biggest earned number, or the sting of the reset. */
function streakLine(summary: DailySummary, won: boolean): string {
  if (won && summary.streak > 1) return `🔥 ${summary.streak} days straight`
  if (won) return '🔥 Streak started — day 1'
  if (summary.bestStreak > 0) return `Streak reset · best remains ${summary.bestStreak}`
  return 'The streak starts with tomorrow’s win.'
}

/**
 * The Daily's post-match wrap. Leaner than the series result screen on stats, heavier on the loop
 * that brings you back: today's verdict, what it did to the streak, the copyable brag, and the door
 * back to the hub (where the countdown to tomorrow's Daily is already running).
 */
export function DailyResultScreen({ result, record, summary, featMints = [], onContinue }: DailyResultScreenProps) {
  const v = verdict(result)
  const twist = twistById(record.twistId)
  const potm = result.playerOfMatch
  const won = result.winner === 'QLD'
  const newFeatNames = featMints.filter((m) => m.isFirst).map((m) => m.def.name)

  return (
    <div className="app-shell result-screen">
      <Wordmark sub="Daily Origin" />
      <div className={`result-banner ${v.cls}`}>
        <h1 className="result-verdict">{v.text}</h1>
        <div className="result-final-score">
          {result.finalScore.qld} – {result.finalScore.nsw}
        </div>
        <div className="result-flavour">{v.flavour}</div>
      </div>

      <div className="daily-wrap-meta">
        <span>{formatDateKey(record.dateKey)}</span>
        <span>⚡ {twist.label}</span>
      </div>

      <div className={`daily-streak-banner ${won ? 'win' : 'loss'}`}>
        <div className="daily-streak-line">{streakLine(summary, won)}</div>
        <div className="daily-streak-record">
          best {summary.bestStreak} · won {summary.wins}/{summary.played} all-time
        </div>
      </div>

      <FeatToast mints={featMints} />

      {result.iconicMoment && (
        <div className={`iconic-moment ${result.iconicMoment.side.toLowerCase()}`}>
          <div className="iconic-moment-label">⭐ The Moment · {result.iconicMoment.minute}′</div>
          <div className="iconic-moment-line">{result.iconicMoment.line}</div>
        </div>
      )}

      <div className="result-broadcast">
        <BroadcastPanel slot="postGame" segments={result.broadcast.postGame} />
      </div>

      <div className={`potm-card ${potm.side.toLowerCase()}`}>
        <div className="potm-label">Player of the Match</div>
        <div className="potm-name">{potm.name}</div>
        <div className="potm-side">{potm.side === 'QLD' ? 'Queensland' : 'New South Wales'}</div>
        <div className="potm-line">
          <strong>{potm.line.runMetres}</strong> m · <strong>{potm.line.tries}</strong>{' '}
          {potm.line.tries === 1 ? 'try' : 'tries'} · <strong>{potm.line.lineBreaks}</strong>{' '}
          {potm.line.lineBreaks === 1 ? 'line break' : 'line breaks'} · <strong>{potm.line.tackles}</strong>{' '}
          {potm.line.tackles === 1 ? 'tackle' : 'tackles'}
        </div>
      </div>

      <ShareCard text={buildDailyShareCard(record, summary, newFeatNames)} />

      {/* The Gauntlet: throw this EXACT match at a mate — same Blues, same twist, same seed. */}
      <ShareCard
        text={buildGauntletShareCard(challengeFromSeed(dailySeed(record.dateKey), record.dateKey), record.finalScore, record.winner)}
      />

      <div className="result-actions">
        <button className="btn-primary" onClick={onContinue}>
          Back to the hub
        </button>
      </div>
    </div>
  )
}
