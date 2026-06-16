import type { Channel, Player, Position } from '../../data/types'
import { matchupRead } from '../../engine'
import type { EdgeMatchup, HeadToHead } from '../../engine'
import './MatchupPanel.css'

interface MatchupPanelProps {
  /** The resolved current QLD selection (only assigned slots present). */
  you: Partial<Record<Position, Player>>
  /** The fixed NSW opponent. */
  opp: Record<Position, Player>
}

const EDGE_LABEL: Record<Channel, string> = {
  LEFT: 'Left edge',
  MIDDLE: 'Middle (forwards)',
  RIGHT: 'Right edge',
}

const EDGE_OWNERS: Record<Channel, string> = {
  LEFT: 'Left centre · left wing · left 2nd-row · five-eighth',
  MIDDLE: 'Lock · props · hooker',
  RIGHT: 'Right centre · right wing · right 2nd-row · halfback',
}

/** Prompt to fill an incomplete edge, matching the channel’s plain-English name. */
const FILL_HINT: Record<Channel, string> = {
  LEFT: 'Fill your left edge to see the read.',
  MIDDLE: 'Fill your middle to see the read.',
  RIGHT: 'Fill your right edge to see the read.',
}

/** A short at-risk headline per edge, framed as the Blues targeting your weak channel. */
function atRiskHeadline(channel: Channel): string {
  if (channel === 'LEFT') {
    return '⚠ Your left edge is under-strength against their right — expect Staggs & Nawaqanitawase to target it.'
  }
  if (channel === 'RIGHT') {
    return '⚠ Your right edge is under-strength against their left — Koula & To’o will run at it.'
  }
  return '⚠ Your middle is under-strength — the Blues pack will roll through the ruck.'
}

/** Bar width as a % of a fixed 100-point scale, clamped so very high ratings still fit. */
function barPct(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function H2H({ label, h2h }: { label: string; h2h: HeadToHead }) {
  return (
    <div className={`mu-h2h verdict-${h2h.verdict}`}>
      <div className="mu-h2h-head">
        <span className="mu-h2h-label">{label}</span>
        <span className="mu-verdict-chip">
          {h2h.verdict === 'advantage' ? 'Advantage' : h2h.verdict === 'at-risk' ? 'At risk' : 'Even'}
          <span className="mu-diff">
            {h2h.diff > 0 ? '+' : ''}
            {h2h.diff}
          </span>
        </span>
      </div>
      <div className="mu-bars">
        <div className="mu-bar-row">
          <span className="mu-bar-who">You</span>
          <span className="mu-bar-track">
            <span className="mu-bar-fill mu-you" style={{ width: `${barPct(h2h.you)}%` }} />
          </span>
          <span className="mu-bar-val">{h2h.you}</span>
        </div>
        <div className="mu-bar-row">
          <span className="mu-bar-who">NSW</span>
          <span className="mu-bar-track">
            <span className="mu-bar-fill mu-opp" style={{ width: `${barPct(h2h.opp)}%` }} />
          </span>
          <span className="mu-bar-val">{h2h.opp}</span>
        </div>
      </div>
    </div>
  )
}

function EdgeRow({ edge }: { edge: EdgeMatchup }) {
  const complete = edge.attack != null && edge.defence != null
  const atRisk =
    edge.attack?.verdict === 'at-risk' || edge.defence?.verdict === 'at-risk'
  return (
    <div className={`mu-edge ${atRisk ? 'mu-edge-danger' : ''}`}>
      <div className="mu-edge-head">
        <span className="mu-edge-name">{EDGE_LABEL[edge.channel]}</span>
        <span className="mu-edge-vs">vs NSW {edge.opponentChannel.toLowerCase()}</span>
      </div>
      <div className="mu-edge-owners">{EDGE_OWNERS[edge.channel]}</div>
      {complete ? (
        <>
          {atRisk && <div className="mu-warning">{atRiskHeadline(edge.channel)}</div>}
          <H2H label="Attack" h2h={edge.attack!} />
          <H2H label="Defence" h2h={edge.defence!} />
        </>
      ) : (
        <div className="mu-fill-hint">{FILL_HINT[edge.channel]}</div>
      )}
    </div>
  )
}

export function MatchupPanel({ you, opp }: MatchupPanelProps) {
  const read = matchupRead(you, opp)
  return (
    <div className="matchup-panel">
      <h3>Matchup Read — your lineup vs the Blues</h3>
      <p className="matchup-sub">
        Each edge attacks the opposite NSW edge and defends what NSW sends back. Attack pits your
        strike against their cover; defence pits their strike against your cover. Pick to shore up
        anything in red.
      </p>
      <div className="mu-edges">
        {read.map((edge) => (
          <EdgeRow key={edge.channel} edge={edge} />
        ))}
      </div>
    </div>
  )
}
