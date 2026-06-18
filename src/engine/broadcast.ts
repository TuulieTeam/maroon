import type { Channel, Player, Position } from '../data/types'
import { NSW_EDGE_THREATS } from '../data/nswSquad'
import type { EdgeThreat } from '../data/nswSquad'
import { makeRng, pick } from './rng'
import type { Rng } from './rng'
import {
  BLUES_VOICES,
  MAROONS_VOICES,
  PERSONAS,
} from './personas'
import type { PersonaId } from './personas'
import type {
  MatchBroadcast,
  MatchEvent,
  MatchResult,
  MatchSetup,
  Segment,
  SeriesStakes,
  SeriesWrap,
  Side,
} from './types'
import { deriveWrap, originLabel } from './series'
import { pickPreMatchSpeech } from './speeches'

const SALT = 0x9e3779b9

const CHANNEL_LABEL: Record<Channel, string> = {
  LEFT: 'left edge',
  MIDDLE: 'middle',
  RIGHT: 'right edge',
}

/**
 * SINGLE SOURCE OF TRUTH for "which of YOUR defensive edges did NSW attack?".
 * NSW run at QLD's LEFT defence down their own RIGHT channel — so an NSW try logged under
 * RIGHT came at the user's left-side defence. Middle stays middle. ResultScreen imports THIS.
 */
export function yourEdgeFor(channel: Channel): 'left' | 'middle' | 'right' {
  if (channel === 'RIGHT') return 'left'
  if (channel === 'LEFT') return 'right'
  return 'middle'
}

/**
 * The clean, commentator-natural phrase for the QLD defensive side NSW are getting at — spoken
 * from Queensland's POV, with NO "the Blues are scoring through X, which is your Y-side defence"
 * double-translation. `yourEdgeFor` already maps the NSW attack channel to the QLD defensive edge;
 * this just dresses it as a single short noun phrase: "your right edge" / "your left edge" /
 * "through the middle". One analyst per segment uses this; the rest talk about other things.
 */
export function yourEdgePhrase(edge: 'left' | 'middle' | 'right'): string {
  if (edge === 'middle') return 'the middle'
  return `your ${edge} edge`
}

// ----------------------------------------------------------------------------------------------
// Fact derivation — everything the booth is allowed to "know", pulled from the real setup/result.
// ----------------------------------------------------------------------------------------------

interface PreGameFacts {
  kicker: string
  fe: string
  hb: string
  fullback: string
  /** QLD picks carrying a real-world injured/suspended/dropped flag (the gambles). */
  gambles: Array<{ name: string; note: string }>
  /** The Maroon defensive edge the drawn Blues side will hunt (their RIGHT attack → your 'left', etc.). */
  pressureEdge: 'left' | 'middle' | 'right'
  /** True if the owners of the pressured edge are soft (avg defence < 70). */
  softPressureEdge: boolean
  /** Average defence of the pressured-edge owners, for colour. */
  pressureEdgeDefence: number
  /** This opponent's primary scouting threat (its lethal channel). */
  edgeThreat: EdgeThreat
  dangerMan: string
}

interface HalfTimeFacts {
  scoreLine: string
  qldAhead: boolean
  level: boolean
  /** Where NSW scored most in the first half → the user's leaking edge phrase. */
  leakingEdge: 'left' | 'middle' | 'right' | null
  leakingChannelLabel: string | null
  qldErrors: number
  qldTries: number
  nswTries: number
  qldLineBreaks: number
  /** QLD player most involved in attacking moments in the first half. */
  standout: string | null
  /** A first-half drama event (sin bin / send-off / failed HIA / forced injury), if any. */
  drama: { player: string; side: Side; type: string } | null
}

interface PostGameFacts {
  scoreLine: string
  winner: Side | 'DRAW'
  qldWon: boolean
  potm: string
  potmSide: Side
  potmLine: string
  /** Where the game was decided defensively (your leaking edge), or null if NSW were shut out. */
  deciderEdge: 'left' | 'middle' | 'right' | null
  deciderChannelLabel: string | null
  /** A short description of the turning point. */
  turningPoint: string
}

function avgDefence(players: Player[]): number {
  if (players.length === 0) return 0
  return players.reduce((s, p) => s + p.attrs.defence, 0) / players.length
}

/** QLD positions that own each defensive zone — used to read the strength of the pressured edge. */
const EDGE_OWNERS: Record<'left' | 'middle' | 'right', Position[]> = {
  left: ['CL', 'WL', 'SRL'],
  right: ['CR', 'WR', 'SRR'],
  middle: ['PR', 'PL', 'HK', 'LK'],
}

/** The booth's short phrase for where the OPPONENT attacks from, by their threat channel. */
function threatSourcePhrase(channel: Channel): string {
  if (channel === 'MIDDLE') return 'the Blues forward pack'
  return channel === 'RIGHT' ? 'the Blues right edge' : 'the Blues left edge'
}

/** Surname for inline play-by-play voice ("Nathan Cleary" -> "Cleary"). */
function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1] || fullName
}

function derivePreGameFacts(setup: MatchSetup): PreGameFacts {
  const lineup = setup.qld.lineup
  const kickerPlayer =
    Object.values(lineup).find((p) => p.id === setup.qld.kickerId) ?? lineup.HB
  const gambles = Object.values(lineup)
    .filter(
      (p, i, arr) =>
        arr.findIndex((q) => q.id === p.id) === i && // de-dupe (bench cover etc.)
        (p.status === 'injured' || p.status === 'suspended' || p.status === 'dropped'),
    )
    .map((p) => ({ name: p.name, note: p.formNote ?? statusNote(p.status!) }))

  // The drawn Blues side ships its own scouting profile on the team; a fixture/legacy NSW with none
  // attached falls back to the canonical right-edge threat, keeping that path byte-identical.
  const edgeThreats =
    setup.nsw.edgeThreats && setup.nsw.edgeThreats.length > 0 ? setup.nsw.edgeThreats : NSW_EDGE_THREATS
  const edgeThreat = edgeThreats[0]
  const dangerMan = edgeThreat.dangerMen[0] ?? 'their danger man'
  // Map the opponent's attacking channel to the Maroon defensive edge under pressure.
  const pressureEdge = yourEdgeFor(edgeThreat.channel)
  const pressuredOwners = EDGE_OWNERS[pressureEdge].map((pos) => lineup[pos]).filter(Boolean)
  const pressureEdgeDefence = avgDefence(pressuredOwners)

  return {
    kicker: kickerPlayer.name,
    fe: lineup.FE.name,
    hb: lineup.HB.name,
    fullback: lineup.FB.name,
    gambles,
    pressureEdge,
    softPressureEdge: pressureEdgeDefence < 70,
    pressureEdgeDefence: Math.round(pressureEdgeDefence),
    edgeThreat,
    dangerMan,
  }
}

function statusNote(status: NonNullable<Player['status']>): string {
  if (status === 'injured') return 'carrying an injury'
  if (status === 'suspended') return 'under a cloud with the judiciary'
  return 'left out of the official side'
}

/** Index of the HALF_TIME event (or events.length if it never fires — e.g. a truncated stub). */
function halfTimeIndex(events: MatchEvent[]): number {
  const i = events.findIndex((e) => e.type === 'HALF_TIME')
  return i === -1 ? events.length : i
}

const DRAMA_TYPE_LABEL: Record<string, string> = {
  SIN_BIN: 'a man in the bin',
  SEND_OFF: 'a send-off',
  HIA_FAIL: 'a failed head check',
  INJURY_REPLACEMENT: 'a forced injury change',
}

function deriveHalfTimeFacts(result: MatchResult): HalfTimeFacts {
  const events = result.events
  const htIdx = halfTimeIndex(events)
  const firstHalf = events.slice(0, htIdx + 1)
  const htEvent = events[htIdx]
  const score = htEvent?.score ?? { qld: 0, nsw: 0 }

  // NSW first-half tries by channel → most-targeted → the user's leaking edge.
  const nswTryChannels: Record<Channel, number> = { LEFT: 0, MIDDLE: 0, RIGHT: 0 }
  let qldErrors = 0
  let qldTries = 0
  let nswTries = 0
  let qldLineBreaks = 0
  const qldAttackInvolvement = new Map<string, { name: string; n: number }>()
  let drama: HalfTimeFacts['drama'] = null

  const bumpInvolve = (p: Player | undefined) => {
    if (!p) return
    const cur = qldAttackInvolvement.get(p.id) ?? { name: p.name, n: 0 }
    cur.n += 1
    qldAttackInvolvement.set(p.id, cur)
  }

  for (const e of firstHalf) {
    if (e.type === 'TRY') {
      if (e.side === 'NSW') {
        nswTries += 1
        if (e.channel) nswTryChannels[e.channel] += 1
      } else {
        qldTries += 1
        bumpInvolve(e.attacker)
      }
    } else if (e.type === 'ERROR' && e.side === 'QLD') {
      qldErrors += 1
    } else if (e.type === 'LINE_BREAK') {
      if (e.side === 'QLD') {
        qldLineBreaks += 1
        bumpInvolve(e.attacker)
      }
    } else if (e.type === 'MISSED_TACKLE' && e.side === 'QLD') {
      // QLD attacker beating a man — an attacking involvement.
      bumpInvolve(e.attacker)
    }
    if (!drama && (e.type === 'SIN_BIN' || e.type === 'SEND_OFF' || e.type === 'HIA_FAIL' || e.type === 'INJURY_REPLACEMENT')) {
      const who = e.defender ?? e.attacker
      drama = { player: who?.name ?? 'a player', side: e.side, type: e.type }
    }
  }

  // Most-targeted NSW channel (only if they actually scored).
  let leakingChannel: Channel | null = null
  let best = 0
  for (const ch of ['LEFT', 'MIDDLE', 'RIGHT'] as Channel[]) {
    if (nswTryChannels[ch] > best) {
      best = nswTryChannels[ch]
      leakingChannel = ch
    }
  }

  let standout: string | null = null
  let bestN = 0
  for (const { name, n } of qldAttackInvolvement.values()) {
    if (n > bestN) {
      bestN = n
      standout = name
    }
  }

  return {
    scoreLine: `${score.qld}–${score.nsw}`,
    qldAhead: score.qld > score.nsw,
    level: score.qld === score.nsw,
    leakingEdge: leakingChannel ? yourEdgeFor(leakingChannel) : null,
    leakingChannelLabel: leakingChannel ? CHANNEL_LABEL[leakingChannel] : null,
    qldErrors,
    qldTries,
    nswTries,
    qldLineBreaks,
    standout,
    drama,
  }
}

function derivePostGameFacts(result: MatchResult): PostGameFacts {
  const { finalScore, winner, playerOfMatch, stats, events } = result
  const potm = playerOfMatch

  // Decider edge: where NSW scored most across the WHOLE match (byChannel), mapped to your edge.
  const byChannel = stats.byChannel
  let deciderChannel: Channel | null = null
  let bestNsw = 0
  for (const ch of ['LEFT', 'MIDDLE', 'RIGHT'] as Channel[]) {
    if (byChannel[ch].nswTries > bestNsw) {
      bestNsw = byChannel[ch].nswTries
      deciderChannel = ch
    }
  }

  return {
    scoreLine: `${finalScore.qld}–${finalScore.nsw}`,
    winner,
    qldWon: winner === 'QLD',
    potm: potm.name,
    potmSide: potm.side,
    potmLine: `${potm.line.runMetres}m, ${potm.line.tries} tries, ${potm.line.tackles} tackles`,
    deciderEdge: deciderChannel ? yourEdgeFor(deciderChannel) : null,
    deciderChannelLabel: deciderChannel ? CHANNEL_LABEL[deciderChannel] : null,
    turningPoint: deriveTurningPoint(events, winner),
  }
}

/**
 * The turning point: the last TRY that changed the lead (in scan order), else the highest-drama
 * event, else the final/decisive try. Returned as a short human phrase.
 */
function deriveTurningPoint(events: MatchEvent[], _winner: Side | 'DRAW'): string {
  let prevLeader: 'QLD' | 'NSW' | 'LEVEL' = 'LEVEL'
  let lastLeadChange: MatchEvent | null = null
  for (const e of events) {
    if (e.type !== 'TRY' && e.type !== 'CONVERSION') continue
    const leader: 'QLD' | 'NSW' | 'LEVEL' =
      e.score.qld > e.score.nsw ? 'QLD' : e.score.nsw > e.score.qld ? 'NSW' : 'LEVEL'
    if (e.type === 'TRY' && leader !== 'LEVEL' && leader !== prevLeader) {
      lastLeadChange = e
    }
    prevLeader = leader
  }
  if (lastLeadChange) {
    const who = lastLeadChange.attacker?.name ?? 'the strike'
    const side = lastLeadChange.side === 'QLD' ? 'Queensland' : 'New South Wales'
    return `${who}'s try that put ${side} in front for good`
  }

  // No lead change recorded — fall back to the biggest drama beat.
  const dramaOrder = ['SEND_OFF', 'SIN_BIN', 'HIA_FAIL', 'INJURY_REPLACEMENT']
  for (const t of dramaOrder) {
    const d = events.find((e) => e.type === t)
    if (d) {
      const who = (d.defender ?? d.attacker)?.name ?? 'a player'
      return `${who} and ${DRAMA_TYPE_LABEL[t] ?? 'the moment'} that swung it`
    }
  }
  // Last resort — the final try of the match.
  const tries = events.filter((e) => e.type === 'TRY')
  const lastTry = tries[tries.length - 1]
  if (lastTry) return `${lastTry.attacker?.name ?? 'the late try'} sealing it at the death`
  return 'a grinding, arm-wrestle of a contest with no single moment'
}

// ----------------------------------------------------------------------------------------------
// Token substitution — same {token} guard discipline as in-play commentary.
// ----------------------------------------------------------------------------------------------

type Vars = Record<string, string>

function subst(template: string, vars: Vars): string {
  return template.replace(/\{[a-zA-Z]+\}/g, (m) => {
    const key = m.slice(1, -1)
    return vars[key] ?? ''
  })
}

// ----------------------------------------------------------------------------------------------
// Persona line pools. 2-4 distinct in-voice phrasings per persona per segment-purpose.
// ----------------------------------------------------------------------------------------------

// ---- PRE-GAME ----
const PRE_OPEN_BRACEY = [
  'Good evening and welcome to Suncorp Stadium for Origin I — the cauldron is full, the air is electric, and Queensland have named their hand. {fe} and {hb} steer the ship tonight.',
  "Welcome in. It's State of Origin, it's Brisbane, and it doesn't get any bigger. Queensland go with {fe} at five-eighth and {hb} at halfback — let's get the desk's read.",
  'A packed house, a Maroon sea, and a series on the line. {hb} has the keys at halfback for Queensland — we will unpack it all before kick off.',
]

const PRE_ANALYST: Partial<Record<PersonaId, string[]>> = {
  johns: [
    "The thing I'll be watching is Queensland's spine. {hb} and {fe} have to control the ruck and get their kicking game right, because if they don't, {theirHalf} will just squeeze the life out of them.",
    "For me it's all about {yourEdge}. {dangerMan} and {threatPhrase} will go there early and often — that's the pressure point of this whole match.",
    "Halves win Origin. {fe} and {hb} need to be on song, manage the back end of sets, and not give {theirHalf} cheap field position. Get that wrong and it's a long night.",
  ],
  gould: [
    "I'll tell you what — everyone's talking about the Maroons forwards, but this game lives and dies on {yourEdge}. {edgeHeadline}. If it leaks, it's over.",
    "I'll tell you what, picking {fe} and {hb} together is a brave call. Origin punishes anyone who can't handle the speed. We'll find out early whether they're up to it.",
    "I'll tell you what — Queensland have rolled the dice with this side. Sometimes that wins you Origin, sometimes it gets exposed in the first twenty. No middle ground here.",
  ],
  smith: [
    "What I want from Queensland is control through the middle. Win the ruck, let {hb} play off the back of it, and the edges look after themselves. Forwards set the platform — always have.",
    "It comes down to game management. Quiet, patient, build pressure. If {fe} and {hb} can do the simple things under fatigue, Queensland are right in this.",
    "The danger for Queensland is {yourEdge} getting picked apart. {edgeHeadline}. They have to stand up there or it's a long night.",
  ],
  fittler: [
    "I just like the feel of the Queensland spine tonight. {fe}'s got a bit of mongrel about him. It'll be a contest, but they've got blokes who turn up when it's tight.",
    "Origin's about who wants it more. Queensland have picked for it. {yourEdgeCap} worries me a touch, but they've got the players to cover.",
    "Gut feel? This is going to be a brutal, low-margin arm-wrestle. {hb}'s the bloke who has to win the moments for Queensland.",
  ],
  lockyer: [
    "Queensland have picked a side that can play the long game. The key is patience — don't chase it early, let {fe} and {hb} settle, and trust the forwards to lay the platform.",
    "For me the pressure point is clear — {edgeHeadline}. If Queensland can hold up {yourEdge} for the first half, they'll grow into this.",
    "It's about composure. {hb} has the keys, and in Origin the side that keeps its head in the tight moments usually walks away with it.",
  ],
  thurston: [
    "Mate, I love this Queensland side. There's heart in it. {hb} and {fe} have to play what's in front of them — back themselves, and the {ground} crowd will do the rest.",
    "This is what it's all about! Queensland in {city}, a series on the line. If {fe} can get those edges firing and {hb} controls the back end, the Maroons will be tough to beat.",
    "I just want to see them have a crack. {dangerMan}'s a danger, no doubt, but Queensland have the spine to match it. Heart wins Origin, every time.",
  ],
}

const PRE_GAMBLE_DANIKA = [
  "Down here there's plenty of chatter about {gamble} — {gambleNote}. A genuine selection gamble, and all eyes will be on whether it pays off tonight.",
  "Word from the sheds is the {gamble} call has raised eyebrows — {gambleNote}. Queensland are backing it, but it's the talking point pre-game.",
  "The big storyline trackside is {gamble}: {gambleNote}. Bold from the selectors — we'll see in the next eighty whether it's inspired or exposed.",
]

const PRE_NO_GAMBLE_DANIKA = [
  "It's a settled, full-strength Queensland side and the mood trackside is calm and confident. No injury clouds, no late dramas — they just want the whistle to blow.",
  "No late changes, no dramas down here — Queensland are at full strength and itching to get into it. The crowd's already deafening.",
  "Trackside it's all business for Queensland — a clean team sheet, everyone fit, and a {ground} crowd ready to lift them from the first whistle.",
]

const PRE_PREDICT_BRACEY = [
  "So there it is — the danger's {threatPhrase}, the key's that Queensland spine. Strap in. KICK OFF moments away.",
  "Everything points to a tight one decided on the edges. The Maroons faithful are ready. Let's play some Origin football.",
  "The desk is split, the crowd is not. Queensland in Brisbane — here we go. Over to the middle for the kick off.",
]

// ---- SERIES FLAVOUR ----
// Series-gated sibling pools + clause maps. Used ONLY when setup.series is present; the default pools
// above are untouched, so a no-series broadcast is byte-identical. Each sibling pool is the SAME
// length as its default counterpart so `pick(brng, …)` draws identically (the equal-draw discipline
// that keeps a same-seed broadcast deterministic). All series clauses are non-empty, so the injected
// {seriesStakes}/{wrapMood} tokens never leave an empty-token double space.

/** Pre-kickoff stakes clause, injected into the series pre-game pools via {seriesStakes}. */
const SERIES_STAKES_CLAUSE: Record<SeriesStakes, string> = {
  OPENER: 'Game one of three, the shield up for grabs — it all starts here.',
  G2_OPEN_AFTER_DRAW: 'Game one couldn’t be split, so the series is still level — whoever blinks first.',
  G2_CAN_CLINCH: 'Queensland lead the series one-nil and can wrap up the shield tonight.',
  G2_MUST_WIN: 'Queensland trail one-nil — lose tonight and the series is gone.',
  G3_DECIDER: 'One-all, winner takes all — this is the decider.',
  G3_DECIDER_AFTER_DRAW: 'It all comes down to this one — and a draw keeps the shield where it is.',
  G3_DEAD_RUBBER_QLD_UP: 'Queensland have the shield already at two-nil — now it’s about the clean sweep.',
  G3_DEAD_RUBBER_QLD_DOWN: 'The shield’s gone, Queensland down two-nil — pride and the jersey on the line.',
}

/** Post-game series consequence, injected into the post-game wrap via {wrapMood} when in a series. */
const SERIES_WRAP_CLAUSE: Record<SeriesWrap, string> = {
  LEAD_TAKEN: 'Queensland draw first blood in the series — one-nil up.',
  TRAILING: 'The Blues take the opener — Queensland trail one-nil.',
  STALEMATE: 'Nothing between them in the opener — the series stays level.',
  SERIES_CLINCHED_QLD: 'QUEENSLAND HAVE THE SHIELD! Two-nil and unbeatable.',
  LEVELLED_DECIDER: 'The Blues hit back — it’s one-all and we’re off to a decider.',
  KEPT_ALIVE_DECIDER: 'Queensland keep the series alive — one-all, all to play for in the decider.',
  SERIES_LOST_QLD: 'The Blues take the series — two-nil, and the shield heads south.',
  G2_DRAW: 'A stalemate in game two — the series rolls on, still level.',
  DECIDER_WON_QLD: 'QUEENSLAND WIN THE SHIELD! They take the decider and the series.',
  DECIDER_LOST_QLD: 'Heartbreak — the Blues win the decider and the series.',
  DECIDER_DRAW_RETAIN: 'They couldn’t be separated in the decider — Queensland keep the shield.',
  SWEEP_QLD: 'A CLEAN SWEEP! Queensland make it three-nil.',
  DEAD_RUBBER_CONSOLATION_NSW: 'The Blues grab a consolation, but the shield’s long gone — Queensland take the series two-one.',
  DEAD_RUBBER_CONSOLATION_QLD: 'Queensland win the dead rubber — but the series was already lost.',
  WHITEWASH_QLD: 'A clean sweep for the Blues — three-nil, a night to forget for Queensland.',
  DEAD_RUBBER_DRAW: 'A drawn dead rubber — the series result already settled.',
}

const PRE_OPEN_BRACEY_SERIES = [
  'Good evening and welcome to {stadium} for {gameLabel} — the cauldron is full, the air is electric, and Queensland have named their hand. {seriesStakes} {fe} and {hb} steer the ship tonight.',
  "Welcome in. It's State of Origin, it's {city}, and it doesn't get any bigger. {seriesStakes} Queensland go with {fe} at five-eighth and {hb} at halfback — let's get the desk's read.",
  '{gameLabel} from {stadium}, a Maroon sea, and the shield on the line. {seriesStakes} {hb} has the keys at halfback for Queensland — we will unpack it all before kick off.',
]

const PRE_PREDICT_BRACEY_SERIES = [
  "So there it is — {seriesStakes} The danger's {threatPhrase}, the key's that Queensland spine. Strap in. KICK OFF moments away.",
  "Everything points to a tight one decided on the edges. {seriesStakes} The Maroons faithful are ready. Let's play some Origin football.",
  "The desk is split, the crowd is not. {gameLabel} from {stadium} — {seriesStakes} here we go. Over to the middle for the kick off.",
]

// ---- HALF-TIME ----
// Generic links (used when NSW haven't scored — no leaking edge to call out yet).
const HT_LINK_BRACEY = [
  "Forty minutes gone and it's {score}, and Queensland have kept the Blues out so far. Let's get the half-time read from the desk.",
  "Half-time at {ground}, the Maroons {htState} at {score} with their line intact. Plenty to talk about — to the panel.",
  "We pause at {score}. A real arm-wrestle through the first half — what did you make of it, fellas?",
]

// Edge-aware links — Bracey SETS THE SCENE whenever NSW have scored: he flags that the Blues have
// found a way through and throws to the desk, WITHOUT naming the edge himself. The single edge
// analyst then owns the diagnosis (clean QLD-POV phrase), so the leaking edge is stated exactly once.
const HT_LINK_BRACEY_EDGE = [
  "Forty minutes gone and it's {score}. The Blues have found a way through — plenty for the desk to chew on.",
  "Half-time, {score}, and New South Wales keep getting on the front foot. Over to the panel.",
  "We pause at {score}. The Blues have done their damage in that half — where, fellas? To the desk.",
]

// EDGE pool — the ONE analyst who diagnoses the leaking edge. A single clean phrase from
// Queensland's defensive POV ({edgePhrase} = "your right edge" / "your left edge" / "through the
// middle"); never "the Blues are scoring through X, which is your Y-side defence".
const HT_ANALYST_EDGE: Partial<Record<PersonaId, string[]>> = {
  johns: [
    "They keep going back to {edgePhrase} and it's working — Queensland have to shut that off or it's the same story after the break.",
    "For mine it's {edgePhrase}: that's where the Blues are living, and the second-half fix has to start there.",
    "{edgePhraseCap} is the leak. Tighten it, get quicker out of the line, and the whole half changes.",
  ],
  smith: [
    "Plain and simple, {edgePhrase} is leaking. Get the line speed right there and the rest tidies itself up.",
    "{edgePhraseCap} keeps getting opened up. That's the one thing I'd be drilling in the sheds right now.",
    "The Blues have found {edgePhrase} and they'll keep coming. Plug it and Queensland are right in this.",
  ],
  gould: [
    "I'll tell you what — {edgePhrase} is getting carved up. Fix that one thing or this is gone.",
    "I'll tell you what, the Blues know exactly where the soft spot is — {edgePhrase} — and they will not stop going there.",
    "I'll tell you what — it's {edgePhrase}, plain as day. Stand it up or it's over.",
  ],
  lockyer: [
    "The pressure point's clear — {edgePhrase}. Shore that up and Queensland are very much in this.",
    "It's {edgePhrase} that's hurting them. Steady it for twenty minutes and the composure will tell.",
    "If Queensland hold up {edgePhrase} now, they'll grow into the second half — that's the whole job.",
  ],
  thurston: [
    "Mate, it's just {edgePhrase} that needs holding — sort that and back themselves, the crowd does the rest.",
    "Get {edgePhrase} right and this is a different game in twenty minutes, I'm telling you.",
    "All the heart's there — they just have to lock down {edgePhrase} and trust the spine.",
  ],
  fittler: [
    "It's {edgePhrase} the Blues are enjoying. Settle that and it's there to be turned around.",
    "{edgePhraseCap} is the one soft spot. Tidy it and Queensland are fine.",
    "Feels like it all comes back to {edgePhrase} — whoever owns that owns the second half.",
  ],
}

// OTHER pool — every voice that is NOT diagnosing the edge talks about something else: errors,
// the standout, the forwards, game management, what must change, the drama. NO edge reference,
// so two personas never restate the same leaking-edge clause.
const HT_ANALYST_OTHER: Partial<Record<PersonaId, string[]>> = {
  johns: [
    "The ruck speed's been the difference for mine — Queensland need quicker play-the-balls so the halves can actually play.",
    "Be smarter with the footy. {errorLine} You cannot gift possession in an Origin decider.",
    "{theirHalf}'s controlling the tempo. Queensland have to win the kick-chase and stop conceding cheap field position.",
  ],
  smith: [
    "It's the simple stuff — complete your sets, hold the ball, build pressure. {errorLine}",
    "Game management hasn't been there. {errorLine} A calm head for twenty minutes and the rest sorts itself.",
    "Win the middle and the platform looks after the rest. The forwards have to go again after the break.",
  ],
  gould: [
    "I'll tell you what, that half was there for the taking and Queensland let it slip. {errorLine} Discipline, first and foremost.",
    "I'll tell you what — they're forcing it. {errorLine} Settle down, do the basics, stop trying to play hero footy.",
    "I'll tell you what, the forwards have to earn the right first. No platform, no second-half comeback. Simple as that.",
  ],
  lockyer: [
    "It's not all bad. {standoutLine} It's about composure now — trust the spine and grind back into it.",
    "There's a foothold here. {standoutLine} Be patient, do the simple things, and the Maroons can turn this.",
    "Half-time's a chance to reset. {errorLine} Patience wins these — don't chase the game.",
  ],
  thurston: [
    "Mate, there's so much football left. {standoutLine} Just back yourselves — the crowd will carry them.",
    "I still love their chances. {standoutLine} Stop the cheap errors and this is a different game.",
    "Heart's not the issue — it's detail. Do the simple things well and Queensland win the second half, I'm sure of it.",
  ],
  fittler: [
    "Queensland just look a fraction off. {errorLine} Nothing a clear head can't fix, but they have to start now.",
    "It's a momentum game now. {standoutLine} Whoever gets the next try probably takes control.",
    "They've just got to want it a bit more in that second forty — the talent's there.",
  ],
}

const HT_DANIKA = [
  "The message coming out of the Queensland sheds is exactly that — fix the edge, hold the ball, and trust the forwards. Calm in there, but they know the work to do.",
  "Down in the tunnel the Maroons looked focused rather than rattled — the word is 'composure', and they fancy their second-half fitness.",
  "Queensland staff telling me the plan doesn't change — tighten things up, complete their sets, and let the crowd lift them. They're confident the legs will tell late.",
]

const HT_DANIKA_DRAMA = [
  "And the big talking point trackside is {dramaPlayer} — {dramaDesc}. That's reshaped the whole complexion of this half.",
  "Plenty of drama down here around {dramaPlayer}: {dramaDesc}. The medical and coaching staff have been busy — it's changed the math of this contest.",
  "{dramaPlayer} is the story trackside — {dramaDesc}. Both benches are recalibrating on the back of it.",
]

// ---- POST-GAME ----
const POST_WRAP_BRACEY = [
  "FULL TIME at {ground} and it finishes {score}. {wrapMood} Let's get the verdict.",
  "That's the match — {score}. {wrapMood} To the desk for the final word.",
  "Eighty minutes done, {score} the final score. {wrapMood} What a Test match of rugby league.",
]

const POST_POTM_BRACEY = [
  "Player of the Match goes to {potm} — {potmLine}. A performance that defined the night.",
  "The medal is {potm}'s tonight: {potmLine}. Hard to argue with that.",
  "{potm} takes the Player of the Match honours — {potmLine}. Stood up when it mattered.",
]

const POST_VERDICT: Partial<Record<PersonaId, string[]>> = {
  // QLD-leaning (used when Queensland win)
  lockyer: [
    "That's a proud Queensland performance. They held their nerve, fixed the things that needed fixing, and {decider} got sorted when it counted. Thoroughly deserved.",
    "Composure won that for the Maroons. They were patient, they trusted their spine, and {decider} stopped being the problem it threatened to be. Big result.",
    "Queensland did it the hard way and the right way. {decider} The forwards laid the platform and the class told late — that's Origin football.",
  ],
  thurston: [
    "QUEEEEENSLANDER! That's what it's all about, mate — heart, mateship, and a refusal to lose. {decider} They earned every inch of that.",
    "I'm getting emotional here — that was Queensland to the core. They wanted it more, simple as that. {decider} What a night for the Maroons!",
    "Unbelievable scenes! Queensland dug deep, the crowd lifted them, and they got the job done. {decider} Pure Origin.",
  ],
  smith: [
    "Queensland controlled the controllables. They completed their sets, won the middle, and {decider} The result followed the process — that's how you win Origin.",
    "Dry as it sounds, that was a game-management win. {decider} Queensland did the simple things better for longer. Job done.",
    "The Maroons earned that through the middle. {decider} Win the ruck, hold the ball, let the halves play — it's not complicated, and they did it.",
  ],
  // NSW-leaning (used when the Blues win, or a QLD loss/draw)
  fittler: [
    "The Blues just wanted it that bit more tonight. {decider} They found the soft spot and kept going there — clinical stuff, full credit to them.",
    "That's a complete New South Wales performance. {decider} They played the percentages, took their chances, and Queensland couldn't live with it.",
    "Felt like the Blues were in control from early. {decider} They identified the edge, hammered it, and never let Queensland settle.",
  ],
  johns: [
    "Tactically that was the Blues all over. {decider} Cleary controlled the tempo, the kicking game was on point, and Queensland's edge couldn't cope.",
    "New South Wales won the spine battle and won the game. {decider} Smarter footy, better ruck speed — Queensland were second to everything that mattered.",
    "The Blues found the pressure point and lived there. {decider} That's a halves clinic — Queensland had no answer to it.",
  ],
  gould: [
    "I'll tell you what — the Blues were ruthless. {decider} They knew the weakness, they exploited it, and they never gave Queensland a sniff. Outstanding.",
    "I'll tell you what, that was a tactical demolition. {decider} New South Wales were smarter, harder, and more disciplined. Deserved winners.",
    "I'll tell you what — Queensland got found out exactly where we said they would. {decider} The Blues did their homework and cashed it in.",
  ],
}

// Neutral verdict for a draw.
const POST_VERDICT_DRAW = [
  "Nothing to separate them after eighty brutal minutes. {decider} Two sides that threw everything at it — and you couldn't begrudge either a share of the points.",
  "A stalemate, and a fitting one. {decider} Origin at its absolute tightest — both sets of fans drained, neither side beaten.",
]

const POST_TURNING_BRACEY = [
  "The moment it turned? {turningPoint}. That's where this match was won and lost.",
  "If you're picking the turning point, it's {turningPoint} — the beat the whole night pivoted on.",
  "Look back and it's {turningPoint} that decided it. The margins in Origin are razor-thin.",
]

const POST_DANIKA = [
  "The mood trackside says it all — {danikaMood} The players are spent, the emotion is raw, and that's exactly what Origin does to you.",
  "Down here it's {danikaMood} You can see eighty minutes of effort written all over them. Unforgettable scenes.",
  "{danikaMood} The sideline emotion is pouring out — win or lose, these blokes left everything on {ground} tonight.",
]

// ----------------------------------------------------------------------------------------------
// Assembly
// ----------------------------------------------------------------------------------------------

function seg(id: PersonaId, line: string): Segment {
  const p = PERSONAS[id]
  return { persona: p.name, role: p.role, line }
}

/** Pick from a pool while avoiding the last analyst persona used within the segment. */
function pickAnalyst(
  brng: Rng,
  candidates: PersonaId[],
  pools: Partial<Record<PersonaId, string[]>>,
  used: Set<PersonaId>,
): { id: PersonaId; line: string } {
  const fresh = candidates.filter((id) => !used.has(id) && pools[id] && pools[id]!.length > 0)
  const eligible = fresh.length > 0 ? fresh : candidates.filter((id) => pools[id] && pools[id]!.length > 0)
  const id = pick(brng, eligible)
  used.add(id)
  const line = pick(brng, pools[id]!)
  return { id, line }
}

interface SeriesBooth {
  /** True when a series context is attached — selects the series-flavoured sibling pools. */
  isSeries: boolean
  /** Venue/game/stakes tokens. Defaults to today's Origin-I/Suncorp/Brisbane literals. */
  vars: Vars
  /** The post-game series consequence clause, used in place of {wrapMood} when in a series. */
  wrapMood: string | null
}

/**
 * Resolve the booth's series tokens. Without a series, returns the legacy literals so every pool
 * renders byte-identical to v1; with one, returns the venue/game/stakes strings and the derived
 * post-game wrap clause (computed here because only the engine has the winner at broadcast time).
 */
function seriesBoothVars(setup: MatchSetup, winner: Side | 'DRAW'): SeriesBooth {
  const s = setup.series
  if (!s) {
    return {
      isSeries: false,
      vars: { gameLabel: 'Origin I', stadium: 'Suncorp Stadium', ground: 'Suncorp', city: 'Brisbane', seriesStakes: '' },
      wrapMood: null,
    }
  }
  return {
    isSeries: true,
    vars: {
      gameLabel: originLabel(s.gameNumber),
      stadium: s.venue.stadium,
      ground: s.venue.groundShort,
      city: s.venue.city,
      seriesStakes: SERIES_STAKES_CLAUSE[s.stakes],
    },
    wrapMood: SERIES_WRAP_CLAUSE[deriveWrap(s.gameNumber, s.seriesScore, winner)],
  }
}

export function buildBroadcast(
  setup: MatchSetup,
  result: Omit<MatchResult, 'broadcast'>,
  seed: number,
): MatchBroadcast {
  // Independent, salted rng — never touches the match event stream.
  const brng = makeRng((seed ^ SALT) >>> 0)

  const pre = derivePreGameFacts(setup)
  const ht = deriveHalfTimeFacts(result as MatchResult)
  const post = derivePostGameFacts(result as MatchResult)
  const sb = seriesBoothVars(setup, post.winner)

  // ---- PRE-GAME ----
  // Opponent-aware threat tokens: the drawn Blues side decides which Maroon edge is under pressure
  // ({yourEdge}), where they attack from ({threatPhrase}), and who runs their show ({theirHalf}).
  const yourEdge = yourEdgePhrase(pre.pressureEdge)
  const yourEdgeCap = yourEdge.charAt(0).toUpperCase() + yourEdge.slice(1)
  const theirHalf = surnameOf(setup.nsw.lineup.HB?.name ?? 'their halfback')
  const threatPhrase = threatSourcePhrase(pre.edgeThreat.channel)
  const preVars: Vars = {
    fe: pre.fe,
    hb: pre.hb,
    fullback: pre.fullback,
    kicker: pre.kicker,
    dangerMan: pre.dangerMan,
    edgeHeadline: pre.edgeThreat.headline,
    yourEdge,
    yourEdgeCap,
    theirHalf,
    threatPhrase,
    ...sb.vars,
  }

  const preGame: Segment[] = []
  preGame.push(seg('bracey', subst(pick(brng, sb.isSeries ? PRE_OPEN_BRACEY_SERIES : PRE_OPEN_BRACEY), preVars)))

  // Two distinct analysts — one Blues-voice flagging the edge threat, one Maroons-voice on the spine,
  // chosen deterministically with no repeat.
  const preUsed = new Set<PersonaId>()
  const preAnalystOrder: PersonaId[] = ['johns', 'gould', 'smith', 'fittler', 'lockyer', 'thurston']
  const a1 = pickAnalyst(brng, preAnalystOrder, PRE_ANALYST, preUsed)
  preGame.push(seg(a1.id, subst(a1.line, preVars)))
  const a2 = pickAnalyst(brng, preAnalystOrder, PRE_ANALYST, preUsed)
  preGame.push(seg(a2.id, subst(a2.line, preVars)))

  // Danika — gamble surfacing (if any) or the clean-sheet line.
  if (pre.gambles.length > 0) {
    const g = pick(brng, pre.gambles)
    preGame.push(
      seg('mason', subst(pick(brng, PRE_GAMBLE_DANIKA), { ...preVars, gamble: g.name, gambleNote: g.note })),
    )
  } else {
    preGame.push(seg('mason', subst(pick(brng, PRE_NO_GAMBLE_DANIKA), preVars)))
  }

  preGame.push(seg('bracey', subst(pick(brng, sb.isSeries ? PRE_PREDICT_BRACEY_SERIES : PRE_PREDICT_BRACEY), preVars)))

  // ---- HALF-TIME ----
  // The leaking-edge clause is a SINGLE clean phrase from QLD's defensive POV (no double-translation).
  const edgePhrase = ht.leakingEdge ? yourEdgePhrase(ht.leakingEdge) : ''
  const edgePhraseCap = edgePhrase ? edgePhrase.charAt(0).toUpperCase() + edgePhrase.slice(1) : ''
  const errorLine =
    ht.qldErrors > 0
      ? `${ht.qldErrors} error${ht.qldErrors === 1 ? '' : 's'} from Queensland in that half hurt them.`
      : `Queensland's completion has actually been solid.`
  const standoutLine = ht.standout
    ? `${ht.standout} has been Queensland's best, busy and dangerous every time he's touched it.`
    : `Queensland are still searching for a spark out wide.`
  const htState = ht.qldAhead ? 'ahead' : ht.level ? 'level' : 'behind'

  const htVars: Vars = {
    score: ht.scoreLine,
    edgePhrase,
    edgePhraseCap,
    errorLine,
    standoutLine,
    htState,
    theirHalf,
    ...sb.vars,
  }

  const halfTime: Segment[] = []
  // Bracey sets the scene. If NSW have scored, he names the leaking edge ONCE (clean phrasing); else generic.
  const hasLeak = ht.leakingEdge !== null
  const htLinkPool = hasLeak ? HT_LINK_BRACEY_EDGE : HT_LINK_BRACEY
  halfTime.push(seg('bracey', subst(pick(brng, htLinkPool), htVars)))

  const htUsed = new Set<PersonaId>()
  const htAnalystOrder: PersonaId[] = ['johns', 'smith', 'gould', 'lockyer', 'thurston', 'fittler']
  // De-dupe by construction: at most ONE analyst diagnoses the edge (only when there's a leak);
  // every other analyst draws from the edge-free OTHER pool, so no two personas restate the edge.
  const h1 = pickAnalyst(brng, htAnalystOrder, hasLeak ? HT_ANALYST_EDGE : HT_ANALYST_OTHER, htUsed)
  halfTime.push(seg(h1.id, subst(h1.line, htVars)))
  // The second analyst always talks about something other than the edge (errors / standout / forwards / drama).
  const h2 = pickAnalyst(brng, htAnalystOrder, HT_ANALYST_OTHER, htUsed)
  halfTime.push(seg(h2.id, subst(h2.line, htVars)))

  if (ht.drama) {
    const dramaDesc = DRAMA_TYPE_LABEL[ht.drama.type] ?? 'a key moment'
    halfTime.push(
      seg('mason', subst(pick(brng, HT_DANIKA_DRAMA), { ...htVars, dramaPlayer: ht.drama.player, dramaDesc })),
    )
  } else {
    halfTime.push(seg('mason', subst(pick(brng, HT_DANIKA), htVars)))
  }

  // ---- POST-GAME ----
  // Same clean QLD-POV phrasing as half-time — name the edge once, no double-translation.
  const decider = post.deciderEdge
    ? `New South Wales did their damage down ${yourEdgePhrase(post.deciderEdge)} — that was the difference.`
    : `Queensland's defence held up across the park, and that was the platform.`
  const wrapMood = sb.isSeries
    ? (sb.wrapMood as string)
    : post.winner === 'QLD'
      ? 'Queensland have done it in Brisbane.'
      : post.winner === 'NSW'
        ? 'The Blues have silenced Suncorp.'
        : "Honours even — they couldn't be separated."
  const danikaMood =
    post.winner === 'QLD'
      ? 'pure Maroon joy — players, staff and fans as one.'
      : post.winner === 'NSW'
        ? 'a stunned Queensland crowd and jubilant Blues.'
        : 'a strange, exhausted stillness — nobody quite sure how to feel.'

  const postVars: Vars = {
    score: post.scoreLine,
    potm: post.potm,
    potmLine: post.potmLine,
    decider,
    turningPoint: post.turningPoint,
    wrapMood,
    danikaMood,
    ...sb.vars,
  }

  const postGame: Segment[] = []
  postGame.push(seg('bracey', subst(pick(brng, POST_WRAP_BRACEY), postVars)))
  postGame.push(seg('bracey', subst(pick(brng, POST_POTM_BRACEY), postVars)))

  // Verdict — winner-leaning voice. QLD win → MAROONS_VOICES; NSW win / QLD loss → BLUES_VOICES;
  // draw → a neutral two-line pool delivered by a measured voice (Locky).
  if (post.winner === 'QLD') {
    const v = pickAnalyst(brng, MAROONS_VOICES, POST_VERDICT, new Set())
    postGame.push(seg(v.id, subst(v.line, postVars)))
  } else if (post.winner === 'NSW') {
    const v = pickAnalyst(brng, BLUES_VOICES, POST_VERDICT, new Set())
    postGame.push(seg(v.id, subst(v.line, postVars)))
  } else {
    postGame.push(seg('lockyer', subst(pick(brng, POST_VERDICT_DRAW), postVars)))
  }

  postGame.push(seg('bracey', subst(pick(brng, POST_TURNING_BRACEY), postVars)))
  postGame.push(seg('mason', subst(pick(brng, POST_DANIKA), postVars)))

  return {
    preGame,
    halfTime,
    postGame,
    preMatchSpeech: pickPreMatchSpeech(seed, setup.series?.stakes, setup.series?.usedSpeechTitles),
  }
}
