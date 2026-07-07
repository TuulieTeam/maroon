import type { Channel } from '../../data/types'
import type { MatchResult, PlayerStatLine, Side } from '../../engine'
import { yourEdgeFor, yourEdgePhrase } from '../../engine'
import type { BackPage, PressExchange } from '../../coach'
import type { FeatMint } from '../../feats'
import type { SeriesState } from '../../series'
import { BackPagePanel, PressConferencePanel } from '../components/BackPagePanel'
import { BroadcastPanel } from '../components/BroadcastPanel'
import { FeatToast } from '../components/FeatToast'
import { SeriesScoreboard } from '../components/SeriesScoreboard'
import './ResultScreen.css'

interface ResultScreenProps {
  result: MatchResult
  gameLabel: string
  /** Series state AFTER this game has been folded in — drives the standings + the continue button. */
  seriesState: SeriesState
  /** Feats earned by this game (and, on a series-ending game, the series) — the toast moment. */
  featMints?: FeatMint[]
  /** The morning-after back page — the paper's pre-game position, settled by this result. */
  backPage?: BackPage | null
  /** Slater fronting the press after the game. */
  pressConference?: PressExchange[]
  onContinue: () => void
}

function verdict(result: MatchResult, gameLabel: string): { cls: string; text: string; flavour: string } {
  if (result.winner === 'QLD') {
    return {
      cls: 'win',
      text: `QUEENSLAND WIN ${gameLabel.toUpperCase()}`,
      flavour: 'The cauldron erupts. Your 17 got the job done.',
    }
  }
  if (result.winner === 'NSW') {
    return {
      cls: 'loss',
      text: `The Blues take ${gameLabel}`,
      flavour: 'A long trip home for the Maroons. Where did it slip away?',
    }
  }
  return { cls: 'draw', text: 'A STALEMATE', flavour: 'Eighty minutes, nothing in it. Origin at its tightest.' }
}

/** What the single continue button says, given how this game changed the series. */
function continueLabel(state: SeriesState): string {
  if (state.status === 'complete') return 'To the series wrap'
  if (state.seriesWinner != null) return 'Shield decided — to the series hub'
  return 'To the series hub'
}

/**
 * NSW attacks QLD's LEFT defence down NSW's RIGHT channel: NSW tries logged under RIGHT
 * came at the user's left-edge defence. Surface the channel where they leaked most.
 */
function channelCallout(result: MatchResult): string | null {
  const totalNsw = result.stats.tries.NSW
  if (totalNsw === 0) return null
  const byChannel = result.stats.byChannel
  const entries: Array<{ channel: Channel; nsw: number }> = [
    { channel: 'LEFT', nsw: byChannel.LEFT.nswTries },
    { channel: 'MIDDLE', nsw: byChannel.MIDDLE.nswTries },
    { channel: 'RIGHT', nsw: byChannel.RIGHT.nswTries },
  ]
  entries.sort((a, b) => b.nsw - a.nsw)
  const worst = entries[0]
  if (worst.nsw === 0) return null

  // The defensive edge the user owns that NSW attacked (single source of truth in broadcast.ts).
  // Use the same cleaned QLD-POV phrasing as the booth — no "through X, which is your Y-side defence".
  const phrase = yourEdgePhrase(yourEdgeFor(worst.channel))
  return `NSW scored ${worst.nsw} of their ${totalNsw} tries down ${phrase}.`
}

function StatCard({
  title,
  q,
  n,
}: {
  title: string
  q: number | string
  n: number | string
}) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-row">
        <span>Queensland</span>
        <span className="q">{q}</span>
      </div>
      <div className="stat-row">
        <span>New South Wales</span>
        <span className="n">{n}</span>
      </div>
    </div>
  )
}

function completionPct(completed: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((completed / total) * 100)}%`
}

function PlayerTable({ side, lines }: { side: Side; lines: PlayerStatLine[] }) {
  const sorted = [...lines]
    .filter((l) => l.minutesProxy > 0 || l.tackles > 0 || l.runs > 0)
    .sort((a, b) => b.runMetres + b.tries * 100 - (a.runMetres + a.tries * 100))
  const label = side === 'QLD' ? 'Queensland' : 'New South Wales'
  return (
    <div className={`player-table ${side.toLowerCase()}`}>
      <div className="player-table-title">{label}</div>
      <table>
        <caption className="sr-only">{label} player statistics</caption>
        <thead>
          <tr>
            <th className="pn" scope="col">Player</th>
            <th scope="col" title="Runs">R</th>
            <th scope="col" title="Run metres">M</th>
            <th scope="col" title="Tackles">T</th>
            <th scope="col" title="Tackle breaks">TB</th>
            <th scope="col" title="Line breaks">LB</th>
            <th scope="col" title="Tries">Tr</th>
            <th scope="col" title="Errors">Err</th>
            <th scope="col" title="Kicks">K</th>
            <th scope="col" title="Kick metres">Km</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr key={l.id}>
              <td className="pn">{l.name}</td>
              <td>{l.runs}</td>
              <td>{l.runMetres}</td>
              <td>{l.tackles}</td>
              <td>{l.tackleBreaks}</td>
              <td>{l.lineBreaks}</td>
              <td>{l.tries}</td>
              <td>{l.errors}</td>
              <td>{l.kicks}</td>
              <td>{l.kickMetres}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResultScreen({
  result,
  gameLabel,
  seriesState,
  featMints = [],
  backPage,
  pressConference = [],
  onContinue,
}: ResultScreenProps) {
  const v = verdict(result, gameLabel)
  const callout = channelCallout(result)
  const { stats, playerOfMatch: potm } = result
  const qldLines = Object.values(stats.players).filter((p) => p.side === 'QLD')
  const nswLines = Object.values(stats.players).filter((p) => p.side === 'NSW')

  // A nod to a one-pointer in the result, if either side landed one (e.g. "incl. 1 QLD field goal").
  const totalFieldGoals = stats.fieldGoals.QLD + stats.fieldGoals.NSW
  const fgNote =
    totalFieldGoals > 0
      ? `incl. ${[
          stats.fieldGoals.QLD > 0 ? `${stats.fieldGoals.QLD} QLD` : null,
          stats.fieldGoals.NSW > 0 ? `${stats.fieldGoals.NSW} NSW` : null,
        ]
          .filter(Boolean)
          .join(' + ')} field goal${totalFieldGoals > 1 ? 's' : ''}`
      : null

  return (
    <div className="app-shell result-screen">
      <div className={`result-banner ${v.cls}`}>
        <h1 className="result-verdict">{v.text}</h1>
        <div className="result-final-score">
          {result.finalScore.qld} – {result.finalScore.nsw}
        </div>
        {fgNote && <div className="result-fg-note">{fgNote}</div>}
        <div className="result-flavour">{v.flavour}</div>
      </div>

      <FeatToast mints={featMints} />

      <SeriesScoreboard state={seriesState} />

      {backPage && <BackPagePanel page={backPage} />}

      <div className="result-broadcast">
        <BroadcastPanel slot="postGame" segments={result.broadcast.postGame} />
      </div>

      <PressConferencePanel exchanges={pressConference} />

      <div className={`potm-card ${potm.side.toLowerCase()}`}>
        <div className="potm-label">Player of the Match</div>
        <div className="potm-name">{potm.name}</div>
        <div className="potm-side">{potm.side === 'QLD' ? 'Queensland' : 'New South Wales'}</div>
        <div className="potm-line">
          <strong>{potm.line.runMetres}</strong> m · <strong>{potm.line.tries}</strong>{' '}
          {potm.line.tries === 1 ? 'try' : 'tries'} · <strong>{potm.line.lineBreaks}</strong>{' '}
          {potm.line.lineBreaks === 1 ? 'line break' : 'line breaks'} · <strong>{potm.line.tackles}</strong>{' '}
          {potm.line.tackles === 1 ? 'tackle' : 'tackles'} · <strong>{potm.line.tackleBreaks}</strong>{' '}
          {potm.line.tackleBreaks === 1 ? 'tackle break' : 'tackle breaks'}
        </div>
      </div>

      {callout && (
        <div className="channel-callout">
          <strong>Where the tries came from:</strong> {callout}
        </div>
      )}

      <div className="stats-grid">
        <StatCard title="Tries" q={stats.tries.QLD} n={stats.tries.NSW} />
        <StatCard title="Run metres" q={stats.runMetres.QLD} n={stats.runMetres.NSW} />
        <StatCard title="Line breaks" q={stats.lineBreaks.QLD} n={stats.lineBreaks.NSW} />
        <StatCard
          title="Completion"
          q={completionPct(stats.completedSets.QLD, stats.totalSets.QLD)}
          n={completionPct(stats.completedSets.NSW, stats.totalSets.NSW)}
        />
        <StatCard title="Errors" q={stats.errors.QLD} n={stats.errors.NSW} />
        <StatCard title="Penalties conceded" q={stats.penalties.QLD} n={stats.penalties.NSW} />
        <StatCard title="Kicks" q={stats.kicks.QLD} n={stats.kicks.NSW} />
        <StatCard title="Kick metres" q={stats.kickMetres.QLD} n={stats.kickMetres.NSW} />
        <StatCard title="40/20s" q={stats.fortyTwenties.QLD} n={stats.fortyTwenties.NSW} />
        <StatCard title="Forced drop-outs" q={stats.forcedDropOuts.QLD} n={stats.forcedDropOuts.NSW} />
        <StatCard title="Field goals" q={stats.fieldGoals.QLD} n={stats.fieldGoals.NSW} />
      </div>

      <div className="player-tables">
        <PlayerTable side="QLD" lines={qldLines} />
        <PlayerTable side="NSW" lines={nswLines} />
      </div>
      <p className="player-table-legend">
        R runs · M run metres · T tackles · TB tackle breaks · LB line breaks · Tr tries · Err errors · K
        kicks · Km kick metres
      </p>

      <div className="result-actions">
        <button className="btn-primary" onClick={onContinue}>
          {continueLabel(seriesState)}
        </button>
      </div>
    </div>
  )
}
