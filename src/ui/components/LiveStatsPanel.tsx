import { useMemo } from 'react'
import type { MatchEvent, Side } from '../../engine'
import './LiveStatsPanel.css'

interface LiveStatsPanelProps {
  revealed: MatchEvent[]
}

interface LiveTally {
  plays: number
  runMetres: number
  lineBreaks: number
  errors: number
  penalties: number
  tries: number
  setsStarted: number
  setsCompleted: number
  kicks: number
  kickMetres: number
  fortyTwenties: number
  dropOuts: number
  fieldGoals: number
}

const EMPTY = (): LiveTally => ({
  plays: 0,
  runMetres: 0,
  lineBreaks: 0,
  errors: 0,
  penalties: 0,
  tries: 0,
  setsStarted: 0,
  setsCompleted: 0,
  kicks: 0,
  kickMetres: 0,
  fortyTwenties: 0,
  dropOuts: 0,
  fieldGoals: 0,
})

// A set "starts" on the first play after possession changes; the engine doesn't event that, so we
// approximate sets-started by counting set-ending events (every set ends in a try/error/turnover).
const POSSESSION_PLAY = new Set([
  'HIT_UP',
  'TACKLE',
  'MISSED_TACKLE',
  'OFFLOAD',
  'LINE_BREAK',
  'HALF_BREAK',
])

function derive(revealed: MatchEvent[]): { QLD: LiveTally; NSW: LiveTally } {
  const t: Record<Side, LiveTally> = { QLD: EMPTY(), NSW: EMPTY() }
  for (const e of revealed) {
    const side = e.side
    if (side !== 'QLD' && side !== 'NSW') continue
    if (POSSESSION_PLAY.has(e.type)) t[side].plays += 1
    if (typeof e.metres === 'number') t[side].runMetres += e.metres
    if (e.type === 'LINE_BREAK') t[side].lineBreaks += 1
    if (e.type === 'ERROR') t[side].errors += 1
    if (e.type === 'PENALTY' || e.type === 'FOUL_PLAY') {
      // PENALTY/FOUL_PLAY are charged against the offending side carried on the event.
      t[side].penalties += 1
    }
    if (e.type === 'TRY') t[side].tries += 1
    // Kicking game (Pass 2). KICK events credit the kicking side (e.side); the outcome events
    // (FORTY_TWENTY / DROP_OUT / FIELD_GOAL) all carry e.side = the kicking/forcing side. Kept as a
    // SEPARATE tally — the completion derivation below is untouched, so nothing is double-counted.
    if (e.type === 'KICK') {
      t[side].kicks += 1
      if (typeof e.metres === 'number') t[side].kickMetres += e.metres
    }
    if (e.type === 'FORTY_TWENTY') t[side].fortyTwenties += 1
    if (e.type === 'DROP_OUT') t[side].dropOuts += 1
    if (e.type === 'FIELD_GOAL') t[side].fieldGoals += 1
    if (e.setComplete) {
      t[side].setsStarted += 1
      if (e.type === 'KICK' || e.type === 'TRY') t[side].setsCompleted += 1
    }
  }
  return t
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

function StatRow({ title, q, n }: { title: string; q: string | number; n: string | number }) {
  return (
    <div className="live-stat-row">
      <span className="ls-q">{q}</span>
      <span className="ls-title">{title}</span>
      <span className="ls-n">{n}</span>
    </div>
  )
}

export function LiveStatsPanel({ revealed }: LiveStatsPanelProps) {
  const t = useMemo(() => derive(revealed), [revealed])
  const totalPlays = t.QLD.plays + t.NSW.plays

  return (
    <div className="live-stats-panel">
      <div className="live-stats-head">
        <span className="ls-team q">QLD</span>
        <h3>Live stats</h3>
        <span className="ls-team n">NSW</span>
      </div>
      <StatRow title="Possession" q={pct(t.QLD.plays, totalPlays)} n={pct(t.NSW.plays, totalPlays)} />
      <StatRow title="Tries" q={t.QLD.tries} n={t.NSW.tries} />
      <StatRow title="Run metres" q={t.QLD.runMetres} n={t.NSW.runMetres} />
      <StatRow title="Line breaks" q={t.QLD.lineBreaks} n={t.NSW.lineBreaks} />
      <StatRow
        title="Completion"
        q={pct(t.QLD.setsCompleted, t.QLD.setsStarted)}
        n={pct(t.NSW.setsCompleted, t.NSW.setsStarted)}
      />
      <StatRow title="Errors" q={t.QLD.errors} n={t.NSW.errors} />
      <StatRow title="Penalties conceded" q={t.QLD.penalties} n={t.NSW.penalties} />
      <StatRow title="Kicks" q={t.QLD.kicks} n={t.NSW.kicks} />
      <StatRow title="Kick metres" q={t.QLD.kickMetres} n={t.NSW.kickMetres} />
      {(t.QLD.fortyTwenties > 0 || t.NSW.fortyTwenties > 0) && (
        <StatRow title="40/20s" q={t.QLD.fortyTwenties} n={t.NSW.fortyTwenties} />
      )}
      {(t.QLD.fieldGoals > 0 || t.NSW.fieldGoals > 0) && (
        <StatRow title="Field goals" q={t.QLD.fieldGoals} n={t.NSW.fieldGoals} />
      )}
    </div>
  )
}
