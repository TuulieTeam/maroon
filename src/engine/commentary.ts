import type { Channel, Player } from '../data/types'
import type { KickType, MatchEventType, PhaseBucket, ScorelineBucket, Side, Venue } from './types'
import type { Rng } from './rng'

const CHANNEL_PHRASE: Record<Channel, string> = {
  LEFT: 'left edge',
  MIDDLE: 'middle',
  RIGHT: 'right edge',
}

/** Coarse field-position bucket (B2). Derived from the loop's `fieldPosition` (0 = own line, 100 =
 *  opposition line). Threaded purely so an additive `redzone` tag can colour goal-line moments — it
 *  never adds an rng() draw, so the play-stream draw count is unaffected. */
export type FieldZone = 'own-end' | 'middle' | 'redzone'

export interface CommentaryContext {
  rng: Rng
  /** How many times the current attacking channel has been targeted this match. */
  channelTargetCount: number
  score: { qld: number; nsw: number }
  /** Tracks the last template index used per event type to avoid immediate repeats. */
  lastTemplateIndex: Map<string, number>
  /** Rounded clock minute of the event being rendered. */
  minute: number
  /** Coarse scoreline state (margin + leader) at the time of the event. */
  scoreline: ScorelineBucket
  /** Coarse phase of the match (early / middle / last10 / post-siren). */
  phase: PhaseBucket
  /** Coarse attacking field position (B2). Optional — defaults to 'middle' if a caller omits it. */
  fieldZone?: FieldZone
  /** The match venue, for {ground}/{city} tokens. Omitted = the legacy Suncorp/Brisbane default. */
  venue?: Venue
  /** The game label for {gameLabel} (e.g. "Origin II"). Omitted = the legacy "Origin I" default. */
  gameLabel?: string
}

/** Bucket the loop's raw 0–100 attacking field position into a coarse zone for the `redzone` tag. */
export function bucketFieldZone(fieldPosition: number): FieldZone {
  if (fieldPosition >= 80) return 'redzone'
  if (fieldPosition <= 35) return 'own-end'
  return 'middle'
}

/**
 * Margin buckets: ≤6 is tight (within a converted try), ≤12 a handy lead (two scores),
 * beyond that a blowout. Leader determines the QLD/NSW suffix.
 */
export function bucketScoreline(score: { qld: number; nsw: number }): ScorelineBucket {
  const margin = score.qld - score.nsw
  const abs = Math.abs(margin)
  if (abs <= 6) return 'tight'
  if (margin > 0) return abs <= 12 ? 'handy-lead-qld' : 'blowout-qld'
  return abs <= 12 ? 'handy-lead-nsw' : 'blowout-nsw'
}

/** Phase buckets keyed off the clock: openings, the grind, the last ten, and post-siren. */
export function bucketPhase(minute: number): PhaseBucket {
  if (minute >= 80) return 'post-siren'
  if (minute >= 70) return 'last10'
  if (minute <= 12) return 'early'
  return 'middle'
}

/**
 * The active context tags for an event — derived purely from phase + scoreline. 'any' is always
 * present so an 'any'-tagged template is never filtered out, guaranteeing a non-empty pool.
 */
function activeTags(ctx: CommentaryContext): Set<ContextTag> {
  const tags = new Set<ContextTag>(['any'])
  if (ctx.phase === 'early') tags.add('early')
  if (ctx.phase === 'last10') tags.add('last10')
  if (ctx.scoreline === 'tight') tags.add('tight')
  if (ctx.scoreline === 'blowout-qld' || ctx.scoreline === 'blowout-nsw') tags.add('blowout')
  // A tight scoreline in the back end of the match reads as a live, swinging contest.
  if (ctx.scoreline === 'tight' && (ctx.phase === 'last10' || ctx.phase === 'middle')) tags.add('comeback')
  // Goal-line pressure (B2). Additive only — never gates the pool empty (every pool has an 'any' line).
  if (ctx.fieldZone === 'redzone') tags.add('redzone')
  return tags
}

export interface CommentaryInput {
  type: MatchEventType
  side: Side
  channel?: Channel
  attacker?: Player
  defender?: Player
  playerOff?: Player
  playerOn?: Player
  metres?: number
  /** For a KICK event: which kind of kick it was. Pass 2 keys kick-type-aware lines off this. */
  kickType?: KickType
  setComplete?: boolean
  reason?: string
}

/** Context selectors a template opts into. 'any' templates are always eligible (the safe fallback). */
export type ContextTag = 'any' | 'tight' | 'blowout' | 'comeback' | 'last10' | 'early' | 'redzone'

export interface TaggedTemplate {
  tags: ContextTag[]
  text: string
  /**
   * For KICK templates only: the kick type this line is written for. `pickTemplate` filters the KICK
   * pool to lines matching `input.kickType` BEFORE the tag filter + the single rng draw, so a BOMB
   * fires a bomb line, a GRUBBER a grubber line, etc. A KICK template with no `kickType` is a
   * universal fallback (eligible for any kick type). Ignored for non-KICK event types.
   */
  kickType?: KickType
}

/** Wrap flat phrasings as 'any'-tagged so the rare/scripted event types stay context-agnostic. */
function flat(...lines: string[]): TaggedTemplate[] {
  return lines.map((text) => ({ tags: ['any'], text }))
}

const TEMPLATES: Record<MatchEventType, TaggedTemplate[]> = {
  KICKOFF: flat(
    'And we are underway at {ground} — {side} get us started.',
    'The whistle goes, the ball is in the air, {gameLabel} is LIVE.',
    'Here we go. {side} kick off and the cauldron erupts.',
  ),
  // HIGH-FREQUENCY — tagged pools (12-16 each). 'any' lines carry the load; tagged ones colour the
  // moment (some carry {score} so the call references the scoreboard; some are goal-line 'redzone').
  HIT_UP: [
    { tags: ['any'], text: '{attacker} of the {club} crashes it up through the {channelPhrase}.' },
    { tags: ['any'], text: '{attacker} takes the carry down the {channelPhrase}, met head-on by {defender}.' },
    { tags: ['any'], text: 'Hard yards from {attacker}, {defender} there to stop the momentum.' },
    { tags: ['any'], text: '{attacker} hammers into the line, {defender} holds firm.' },
    { tags: ['any'], text: '{attacker} gets the front foot, drags {defender} a couple of extra metres.' },
    { tags: ['any'], text: 'Up the guts goes {attacker} — straight into the meat of the {defender} defence.' },
    { tags: ['any'], text: '{attacker} carts it into the {channelPhrase}, made to work by {defender} on the tackle.' },
    { tags: ['any'], text: 'No nonsense from {attacker} — head down, one out off the ruck, and {defender} stops the roll.' },
    { tags: ['any'], text: 'Strong leg drive from {attacker}, {defender} dragged back a metre but the tackle’s made.' },
    { tags: ['early'], text: 'Feeling each other out early — {attacker} tests the {channelPhrase} with a hit-up.' },
    { tags: ['early'], text: '{attacker} sets the tone first carry, {defender} meets him square.' },
    { tags: ['tight', 'comeback'], text: 'Every metre matters here — {attacker} grinds it forward, {defender} won’t give an inch.' },
    { tags: ['tight', 'comeback'], text: 'At {score}, this is where it’s won — {attacker} earns the tough metres, {defender} hangs on.' },
    { tags: ['redzone'], text: 'Right on the line now — {attacker} throws himself at it, {defender} holds him up short.' },
    { tags: ['last10'], text: 'Tired bodies now — {attacker} still finds the energy to crash it up at {defender}.' },
    { tags: ['blowout'], text: '{attacker} keeps chipping away through the {channelPhrase}, the result long since decided.' },
  ],
  TACKLE: [
    { tags: ['any'], text: '{defender} wraps up {attacker} — good defence.' },
    { tags: ['any'], text: 'Brought down by {defender}. Held.' },
    { tags: ['any'], text: '{attacker} goes nowhere, {defender} all over it.' },
    { tags: ['any'], text: 'Solid tackle from {defender}, {attacker} grounded.' },
    { tags: ['any'], text: '{defender} times it beautifully and {attacker} is stopped in his tracks.' },
    { tags: ['any'], text: 'Gang-tackled — {defender} and the cavalry swallow up {attacker} and slow the play-the-ball.' },
    { tags: ['any'], text: '{defender} gets under the ball and lifts — {attacker} taken backwards, that’s a dominant tackle.' },
    { tags: ['any'], text: 'Chop tackle from {defender}, {attacker} chopped down at the ankles.' },
    { tags: ['any'], text: '{defender} reads the run perfectly and shuts {attacker} down a metre behind the ruck.' },
    { tags: ['early'], text: 'Defensive line up fast and proud — {defender} pins {attacker} behind the advantage line.' },
    { tags: ['tight', 'comeback'], text: 'This is desperation defence — {defender} drives {attacker} back, the line holding under siege.' },
    { tags: ['tight', 'comeback'], text: 'It’s {score} and every tackle’s a war — {defender} stands {attacker} up and won’t let him fall forward.' },
    { tags: ['redzone'], text: 'Goal-line defence at its best — {defender} bundles {attacker} into touch-in-goal, the line holds!' },
    { tags: ['last10'], text: 'Legs gone, hearts still pumping — {defender} digs in and drops {attacker}.' },
    { tags: ['last10'], text: '{defender} throws the body on the line late, {attacker} held up short.' },
    { tags: ['blowout'], text: '{defender} still completing his tackles even with the game gone — {attacker} held.' },
  ],
  MISSED_TACKLE: [
    { tags: ['any'], text: '{defender} misses! {attacker} slips through the {channelPhrase}.' },
    { tags: ['any'], text: 'Ohh, {defender} can’t hold him — {attacker} breaks the line attempt.' },
    { tags: ['any'], text: '{attacker} beats {defender} on the {channelPhrase}, the defence is scrambling.' },
    { tags: ['any'], text: 'That’s a poor read from {defender}, {attacker} surges through.' },
    { tags: ['any'], text: '{attacker} steps {defender} clean out of his boots in the {channelPhrase}.' },
    { tags: ['any'], text: 'Fend! {attacker} plants a palm in {defender}’s chest and bursts off the {channelPhrase}.' },
    { tags: ['any'], text: '{defender} goes for the big one and whiffs it — {attacker} through the gate.' },
    { tags: ['any'], text: 'Footwork from {attacker} — left-right and {defender} is grasping at air in the {channelPhrase}.' },
    { tags: ['any'], text: '{attacker} bumps off the tackle, {defender} left holding nothing but a fistful of jersey.' },
    { tags: ['early'], text: 'Early warning sign — {defender} flies out of the line and {attacker} skips through the {channelPhrase}.' },
    { tags: ['tight', 'comeback'], text: 'Could be the moment! {defender} jams in, {attacker} darts through the gap in the {channelPhrase}.' },
    { tags: ['tight', 'comeback'], text: 'At {score} you cannot miss them — {defender} does, and {attacker} is away through the {channelPhrase}!' },
    { tags: ['redzone'], text: 'Metres out and {defender} misses the tackle — {attacker} is over the top of him, this looks a try!' },
    { tags: ['last10'], text: 'Fatigue tells — {defender} can’t get there and {attacker} slices through late.' },
    { tags: ['last10'], text: 'Tired legs, soft shoulder — {attacker} brushes {defender} aside down the {channelPhrase}.' },
    { tags: ['blowout'], text: '{defender}’s heart isn’t in it now — {attacker} waltzes through the {channelPhrase}.' },
  ],
  HALF_BREAK: flat(
    '{attacker} half-breaks down the {channelPhrase} before the cover arrives!',
    'Half a gap for {attacker}! Dragged down just in time.',
    '{attacker} sniffs an opening on the {channelPhrase} — nearly clean.',
    '{attacker} threatens through the {channelPhrase}, the cover does just enough.',
  ),
  LINE_BREAK: [
    { tags: ['any'], text: 'LINE BREAK! {attacker} carves through the {channelPhrase}!' },
    { tags: ['any'], text: '{attacker} is GONE through the {channelPhrase} — clean break!' },
    { tags: ['any'], text: 'They’ve sliced it open! {attacker} into open space down the {channelPhrase}!' },
    { tags: ['any'], text: 'The line’s split! {attacker} away through the {channelPhrase} with grass in front!' },
    { tags: ['any'], text: '{attacker} hits the hole at pace — clean line break in the {channelPhrase}!' },
    { tags: ['any'], text: 'Dummy and away! {attacker} sells it, takes off through the {channelPhrase}, the line’s in bits!' },
    { tags: ['any'], text: '{attacker} steps back inside and there’s nobody home — clean break in the {channelPhrase}!' },
    { tags: ['any'], text: 'Half-gap turned full break — {attacker} accelerates through the {channelPhrase}, cover scrambling!' },
    { tags: ['any'], text: 'They’ve been cut to ribbons! {attacker} streaks through the {channelPhrase} into open field!' },
    { tags: ['early'], text: 'And it’s wide open early! {attacker} bursts through the {channelPhrase} — what a start!' },
    { tags: ['tight', 'comeback'], text: 'THIS could break it open! {attacker} tears through the {channelPhrase}, the cover in tatters!' },
    { tags: ['tight', 'comeback'], text: 'At {score} this is the crack they needed — {attacker} splits the line in the {channelPhrase}!' },
    { tags: ['redzone'], text: 'Right on the line and they’ve broken through! {attacker} barges past the cover in the {channelPhrase}!' },
    { tags: ['last10'], text: 'In the dying stages — {attacker} finds the legs to crack the line in the {channelPhrase}!' },
    { tags: ['last10'], text: 'When it matters most! {attacker} splits them down the {channelPhrase}!' },
    { tags: ['blowout'], text: 'Adding insult to injury — {attacker} strolls through the {channelPhrase} for another break.' },
  ],
  OFFLOAD: flat(
    'Brilliant offload from {attacker} to keep it alive!',
    '{attacker} flicks it out of the tackle — the play rolls on.',
    'Magic hands from {attacker}, the offload sticks.',
    '{attacker} keeps the arms free and pops it away — second phase on!',
  ),
  ERROR: [
    { tags: ['any'], text: 'Knock-on! {attacker} spills it cold. Turnover.' },
    { tags: ['any'], text: '{attacker} coughs it up — the handling lets them down.' },
    { tags: ['any'], text: 'Dropped! {attacker} can’t hold the pill, and that’s a turnover.' },
    { tags: ['any'], text: 'Loose carry from {attacker}, the ball goes to ground.' },
    { tags: ['any'], text: '{attacker} tries to force it and puts it down — possession gone.' },
    { tags: ['any'], text: 'Stripped in the tackle — {attacker} loses the footy and the whistle says handover.' },
    { tags: ['any'], text: 'Forward pass off the hands of {attacker} — the move breaks down, scrum the other way.' },
    { tags: ['any'], text: 'Played at and lost — {attacker} can’t reel in the offload and it bounces dead.' },
    { tags: ['any'], text: '{attacker} overplays his hand, throws the cut-out and it goes to ground. Sloppy.' },
    { tags: ['early'], text: 'Nerves there — {attacker} grasses it cold inside the first set or two.' },
    { tags: ['tight', 'comeback'], text: 'Costly! In a game this tight, {attacker} fumbles it and hands the momentum straight back.' },
    { tags: ['tight', 'comeback'], text: 'You cannot do that here — {attacker} drops it cold with everything in the balance.' },
    { tags: ['tight', 'comeback'], text: 'At {score} that is criminal — {attacker} butchers it and gifts the footy back.' },
    { tags: ['redzone'], text: 'On the line and they’ve dropped it! {attacker} grasses it cold over the chalk — try-scoring chance gone!' },
    { tags: ['last10'], text: 'Heartbreak — {attacker} butchers it late, and that could be the ballgame.' },
    { tags: ['blowout'], text: '{attacker} loses it forward, but it barely matters on this scoreline.' },
  ],
  PENALTY: flat(
    'Penalty against {defender} — discipline cracks under pressure.',
    'There’s the whistle. {defender} gives one away cheaply.',
    '{defender} caught offside, and the {side} hand over field position.',
    'Ill-discipline from {defender} — the referee’s arm is out.',
  ),
  // KICK is kick-type-aware (Pass 2). pickTemplate filters this pool to lines whose `kickType` matches
  // input.kickType FIRST (universal — no kickType — lines are always eligible), THEN by context tag,
  // THEN the single rng draw. Each KickType has ≥3 phrasings so repeat-avoidance has room. The handful
  // of untyped 'any' lines are safe universal fallbacks for any kick.
  KICK: [
    // CLEARING — the default long downfield kick to flip the field.
    { tags: ['any'], kickType: 'CLEARING', text: 'Last tackle — {attacker} sends up a long spiral downfield to flip the field.' },
    { tags: ['any'], kickType: 'CLEARING', text: '{attacker} hoists a clearing kick deep, the territory swap is on.' },
    { tags: ['any'], kickType: 'CLEARING', text: '{attacker} drills it long and high to end the set — handing over field position the smart way.' },
    { tags: ['tight', 'comeback'], kickType: 'CLEARING', text: '{attacker} pins them deep with a clearer — territory is gold at {score}.' },
    { tags: ['last10'], kickType: 'CLEARING', text: 'Clock winding down — {attacker} just clears his lines and trusts the defence.' },
    // BOMB — a high ball hung up for the chasers to contest.
    { tags: ['any'], kickType: 'BOMB', text: 'Bomb on the last! {attacker} puts it up and the chasers tear after it.' },
    { tags: ['any'], kickType: 'BOMB', text: '{attacker} hangs one up under the high ball — the chase has time to get there.' },
    { tags: ['any'], kickType: 'BOMB', text: 'Up it goes from {attacker} — a towering bomb, and it’s anyone’s in the air.' },
    { tags: ['tight', 'comeback'], kickType: 'BOMB', text: 'At {score} {attacker} hangs one up and trusts the chase to win it back.' },
    { tags: ['last10'], kickType: 'BOMB', text: 'Clock winding down — {attacker} sends up a bomb and chases the contest.' },
    // GRUBBER — a low rolling kick into the in-goal.
    { tags: ['any'], kickType: 'GRUBBER', text: 'Grubber in behind from {attacker}, chasing a repeat set.' },
    { tags: ['any'], kickType: 'GRUBBER', text: '{attacker} rolls one along the deck — the grubber skids in behind the line.' },
    { tags: ['any'], kickType: 'GRUBBER', text: '{attacker} stabs a low grubber through the legs of the defence, chasers swarming.' },
    { tags: ['redzone'], kickType: 'GRUBBER', text: '{attacker} stabs a grubber into the in-goal — anyone’s ball over the line!' },
    // CROSS_FIELD — a wide kick to a winger in the corner.
    { tags: ['any'], kickType: 'CROSS_FIELD', text: '{attacker} floats a cross-field kick to the corner — the winger climbs for it!' },
    { tags: ['any'], kickType: 'CROSS_FIELD', text: 'Banana kick across field from {attacker}, curling away from the fullback toward the corner.' },
    { tags: ['any'], kickType: 'CROSS_FIELD', text: '{attacker} goes wide with the cross-fielder — it’s a jump-ball out on the flank.' },
    { tags: ['redzone'], kickType: 'CROSS_FIELD', text: 'Cross-field bomb from {attacker} to the corner — the winger out-leaps his man on the chalk!' },
    // FORTY_TWENTY — the attempt: low, raking, hunting the sideline inside the 20.
    { tags: ['any'], kickType: 'FORTY_TWENTY', text: 'Forty-twenty in the making? {attacker} drills it low and it’s racing for the sideline.' },
    { tags: ['any'], kickType: 'FORTY_TWENTY', text: '{attacker} is going for the 40/20 — raking it along the touchline, will it sit up?' },
    { tags: ['any'], kickType: 'FORTY_TWENTY', text: '{attacker} aims one at the corner from deep — that’s a 40/20 attempt all day.' },
    { tags: ['tight', 'comeback'], kickType: 'FORTY_TWENTY', text: 'At {score} {attacker} backs the boot — drilling it for the sideline, a 40/20 the difference here.' },
    // FIELD_GOAL — the attempt: dropping into the pocket for the one-pointer.
    { tags: ['any'], kickType: 'FIELD_GOAL', text: '{attacker} drops into the pocket… lining up the one-pointer.' },
    { tags: ['any'], kickType: 'FIELD_GOAL', text: 'Here’s the field-goal attempt — {attacker} steps back into the pocket and takes aim at the posts.' },
    { tags: ['any'], kickType: 'FIELD_GOAL', text: '{attacker} sets for the drop goal — one point on offer, and up it goes.' },
    { tags: ['last10', 'tight'], kickType: 'FIELD_GOAL', text: 'This could win it! At {score} {attacker} drops into the pocket for the one-pointer…' },
    // TOUCH — a penalty kick for touch (set by the penalty branch).
    { tags: ['any'], kickType: 'TOUCH', text: '{attacker} takes the kick for touch — territory gained, and the {side} keep the feed.' },
    { tags: ['any'], kickType: 'TOUCH', text: 'Penalty taken — {attacker} finds the sideline and the {side} march downfield.' },
    { tags: ['any'], kickType: 'TOUCH', text: '{attacker} thumps it out on the full into touch — a big chunk of field, and possession stays put.' },
    // Universal fallbacks (no kickType) — always eligible for any kick. Generic, never type-specific.
    { tags: ['any'], text: 'Last tackle — {attacker} puts the boot to it.' },
    { tags: ['any'], text: '{attacker} hoists a kick downfield to end the set.' },
    { tags: ['last10'], text: 'Time almost up — {attacker} kicks, the chasers desperate to force the error.' },
  ],
  TRY: [
    { tags: ['any'], text: 'TRY! {attacker} plants it down the {channelPhrase}!' },
    { tags: ['any'], text: 'They’ve scored! {attacker} crashes over through the {channelPhrase}!' },
    { tags: ['any'], text: '{attacker} dives in! Four points down the {channelPhrase}!' },
    { tags: ['any'], text: 'Over he goes! {attacker} grounds it in the corner off the {channelPhrase}!' },
    { tags: ['any'], text: 'FOUR POINTS! {attacker} finishes it off in the {channelPhrase}!' },
    { tags: ['any'], text: 'He’s reached out and got it down! {attacker} stretches over the line in the {channelPhrase}!' },
    { tags: ['any'], text: 'What a finish! {attacker} beats the fullback and slides in beside the posts off the {channelPhrase}!' },
    { tags: ['any'], text: 'They’ve gone the length! It ends with {attacker} planting it in the {channelPhrase}!' },
    { tags: ['any'], text: '{attacker} skips out of the tackle and reaches out one-handed — TRY in the {channelPhrase}!' },
    { tags: ['early'], text: 'First blood! {attacker} opens the scoring through the {channelPhrase}!' },
    { tags: ['tight', 'comeback'], text: 'WHAT A TIME TO SCORE! {attacker} crosses in the {channelPhrase} and this game has turned!' },
    { tags: ['tight', 'comeback'], text: 'Right on cue! {attacker} barges over the {channelPhrase} with the contest on a knife edge!' },
    { tags: ['tight', 'comeback'], text: 'And that could be the lead! {attacker} dives over in the {channelPhrase} — it’s {score}!' },
    { tags: ['redzone'], text: 'The pressure tells! {attacker} forces his way over from close range in the {channelPhrase}!' },
    { tags: ['last10'], text: 'LATE TRY! {attacker} goes over down the {channelPhrase} — drama at the death!' },
    { tags: ['blowout'], text: 'They’re piling it on — {attacker} adds another through the {channelPhrase}.' },
  ],
  CONVERSION: flat(
    '{attacker} lines it up... and it sails through. Conversion good.',
    'The kick from {attacker} is true — extras added.',
    '{attacker} slots the conversion. {score}.',
    '{attacker} makes no mistake from the tee — two more.',
  ),
  // Pass 2 — full tagged outcome pools. These are emitted by the engine AFTER the KICK event as the
  // resolved result of the kicking game. Each substitutes cleanly (no leftover {token}) and is non-empty.
  // DROP_OUT — the kicking side forced it dead in-goal and WINS the drop-out (possession retained).
  DROP_OUT: [
    { tags: ['any'], text: 'Forced it dead! The {side} earn the drop-out — fresh set, great field position.' },
    { tags: ['any'], text: 'Bombed dead in-goal — the {side} force the drop-out and get the ball straight back.' },
    { tags: ['any'], text: 'Pressure pays off — the {side} pin them in-goal and it’s a drop-out, ball back to the {side}.' },
    { tags: ['any'], text: 'They’ve squeezed the error in-goal — drop-out coming, and the {side} reload deep in attack.' },
    { tags: ['tight', 'comeback'], text: 'Huge moment at {score} — the {side} force the drop-out and keep the squeeze on.' },
    { tags: ['last10'], text: 'Exactly what they needed late — the {side} force a drop-out and stay camped on attack.' },
    { tags: ['redzone'], text: 'Right on the line the chase wins it — the {side} force the drop-out, the heat stays on.' },
  ],
  // FORTY_TWENTY — a SUCCESSFUL 40/20. The kicking side regains the feed deep in the opp half.
  FORTY_TWENTY: [
    { tags: ['any'], text: 'FORTY-TWENTY! {attacker} nails it — the {side} get the ball back deep in the opposition half!' },
    { tags: ['any'], text: '{attacker} lands the 40/20! What a weapon — it bounced out inside the 20 and the {side} keep the ball.' },
    { tags: ['any'], text: 'Oh, that is sensational from {attacker} — a perfect 40/20, and the {side} have the feed in attack!' },
    { tags: ['any'], text: 'He’s found the corner! {attacker} drills the 40/20 and the {side} have flipped the whole game with one boot.' },
    { tags: ['last10', 'tight'], text: 'WHAT A TIME! At {score} {attacker} pulls out a 40/20 — the {side} steal the field position and the feed!' },
    { tags: ['comeback'], text: 'That could be the swing — {attacker}’s 40/20 hands the {side} a set deep in opposition territory.' },
  ],
  // FIELD_GOAL — a MADE one-point drop goal. {score} already reflects the point at emit time.
  FIELD_GOAL: [
    { tags: ['any'], text: '{attacker} drops into the pocket… and it’s ONE POINT to the {side}! {score}.' },
    { tags: ['any'], text: 'It’s over! {attacker} steers the field goal through — a one-pointer for the {side}, {score}.' },
    { tags: ['any'], text: 'FIELD GOAL! {attacker} splits the posts from the pocket — the {side} nudge ahead, {score}.' },
    { tags: ['any'], text: '{attacker} makes no mistake with the drop goal — one point, and it could be huge. {score}.' },
    { tags: ['last10', 'tight'], text: 'ICE IN THE VEINS! At the death {attacker} slots the one-pointer for the {side} — {score} and you can’t separate them!' },
    { tags: ['last10'], text: 'The dagger! {attacker} calmly drops one over for the {side} late — {score}.' },
  ],
  // REPEAT_SET — possession retained off a regained kick (bomb knocked back by the chasers).
  REPEAT_SET: [
    { tags: ['any'], text: 'Knocked back by the chasers — the {side} get another crack with a fresh set.' },
    { tags: ['any'], text: 'They’ve regained it! The bomb’s batted back and the {side} reload with a repeat set.' },
    { tags: ['any'], text: 'Repeat set for the {side} — the chase did its job and the pressure stays on.' },
    { tags: ['any'], text: 'The {side} live to fight another six — the kick’s regained and it’s a fresh set on attack.' },
    { tags: ['tight', 'comeback'], text: 'Massive at {score} — the {side} win the ball back off the chase, repeat set and the squeeze is on.' },
    { tags: ['redzone'], text: 'Right on the line they get it back — a repeat set for the {side}, the line under siege again.' },
  ],
  TURNOVER_DOWNTOWN: [
    { tags: ['any'], text: 'Turnover! The set comes up empty and possession flips.' },
    { tags: ['any'], text: 'Handed back on tackle six — no points from that raid.' },
    { tags: ['any'], text: 'The {side} hand it over, set complete with nothing to show.' },
    { tags: ['any'], text: 'Nothing comes of it — the {side} cough up possession on the last.' },
    { tags: ['any'], text: 'The kick’s taken on the full — the {side} get nothing and it’s a changeover.' },
    { tags: ['any'], text: 'Caught and held in-goal — seven-tackle set the other way for the {side}’s trouble.' },
    { tags: ['any'], text: 'Six and out for the {side} — the chase is dead and the footy comes back.' },
    { tags: ['any'], text: 'All that pressure and the {side} have nothing to show — possession surrendered.' },
    { tags: ['any'], text: 'The bomb’s claimed cleanly — the {side} blew the last-tackle option and hand over.' },
    { tags: ['tight', 'comeback'], text: 'A wasted set the {side} can’t afford — possession handed straight back.' },
    { tags: ['tight', 'comeback'], text: 'At {score} that set had to count — instead the {side} get zero and the footy flips.' },
    { tags: ['redzone'], text: 'Right on the line and the {side} come up empty — the goal-line stand holds!' },
    { tags: ['last10'], text: 'Big set squandered late — the {side} get nothing for all that field position.' },
    { tags: ['last10'], text: 'The clock’s their enemy now and the {side} waste the set — costly with time running out.' },
  ],
  INTERCHANGE: flat(
    '{side} go to the bench — {playerOn} on for {playerOff}.',
    'Fresh legs for the {side}: {playerOff} comes off, {playerOn} into the fray.',
    'Interchange. {playerOff} gets a spell, {playerOn} injects himself.',
    'Rotation for the {side} — {playerOff} to the sideline, {playerOn} on.',
  ),
  HEAD_KNOCK: flat(
    '{attacker} stays down after that one — trainers waving for an HIA.',
    'Oh, {attacker} copped that flush. He goes off for a head check.',
    'Concern for {attacker} — straight down the tunnel for an HIA.',
  ),
  HIA_PASS: flat(
    'Good news — {attacker} is cleared and available to return.',
    '{attacker} passes his HIA. No lasting damage.',
    'The doctors clear {attacker} — he can come back on.',
  ),
  HIA_FAIL: flat(
    '{attacker} fails his HIA — he is done for the night.',
    "That's it for {attacker} — ruled out under the concussion protocol.",
    '{attacker} does not pass the head check. No return.',
  ),
  FOUL_PLAY: flat(
    'Ugly stuff — {defender} caught {attacker} high. The whistle is going.',
    "That's foul play from {defender} on {attacker}. The bunker takes a look.",
    '{defender} oversteps the mark on {attacker} — penalty, and worse may follow.',
  ),
  SIN_BIN: flat(
    'TEN MINUTES! {defender} is in the bin and the {side} are down a man.',
    "{defender} sees yellow — off for ten, and it's twelve against thirteen.",
    'Into the sin bin goes {defender}. The {side} must hold on short-handed.',
  ),
  SIN_BIN_RETURN: flat(
    '{defender} is back from the bin — the {side} are back to a full thirteen.',
    "Ten minutes served. {defender} returns and it's even numbers again.",
    '{defender} jogs back on for the {side} — the sin-bin period is up.',
  ),
  SEND_OFF: flat(
    'OFF! {defender} is sent from the field — the {side} finish a man down.',
    'Red card. {defender} is gone for the rest of the match.',
    '{defender} has been marched. No reprieve — the {side} play out short.',
  ),
  INJURY_REPLACEMENT: flat(
    '{attacker} cannot continue — a forced change for the {side}.',
    "That's a match-ending knock for {attacker}. The {side} reshuffle.",
    '{attacker} is helped off injured — the {side} bring on cover.',
  ),
  RESERVE_ACTIVATED: flat(
    'The locked bench is in play — {playerOn} is activated for the {side}.',
    'They unlock the extra man: {playerOn} comes on for the {side}.',
    '{playerOn} gets the call — the {side} tap into their reserve bench.',
  ),
  HALF_TIME: flat(
    'HALF TIME. {score} after forty minutes of Origin football.',
    'The siren sounds for the break — {score}.',
  ),
  FULL_TIME: flat(
    'FULL TIME! It finishes {score}.',
    'The siren! That’s the match — {score}.',
  ),
  // COLOR is an analyst's reply, NOT play-by-play. It has its own salted-rng pools + rendering in
  // colorCommentary.ts and is appended directly by simulateMatch — it NEVER goes through pickTemplate
  // / renderCommentary. This stub exists only to satisfy the exhaustive Record<MatchEventType, …> type;
  // it is never read. (Guarded in renderCommentary too, as belt-and-braces.)
  COLOR: flat(''),
}

const QLD_TRY_LIFT = ['QUEEEEENSLANDER!', 'The Maroons faithful are on their feet!', 'Get up, get up!']
const NSW_TRY_GROAN = ['...and the Blues make you pay.', 'Silence around {ground}.', 'That one hurts, Maroons fans.']

// Drama partisanship: an event happening TO NSW lifts the Maroon crowd; TO QLD draws a groan.
// These are substituted (not raw-appended) so the {ground}/{city} tokens resolve per venue.
const DRAMA_AGAINST_NSW = ['Advantage Queensland.', 'The Maroons smell blood.', '{ground} roars.']
const DRAMA_AGAINST_QLD = ['Heartbreak for the Maroons.', 'You can feel the dread in {city}.', 'This is a body blow.']
const DRAMA_TYPES = new Set<MatchEventType>(['HIA_FAIL', 'SIN_BIN', 'SEND_OFF', 'INJURY_REPLACEMENT'])

function tagFraming(input: CommentaryInput): string | null {
  const a = input.attacker
  const d = input.defender
  if (input.type === 'TRY' && d?.tag === 'bolter' && d.attrs.defence < 60) {
    return `${d.name}, the bolter you picked, is found out down the ${CHANNEL_PHRASE[input.channel ?? 'MIDDLE']} again.`
  }
  if (input.type === 'MISSED_TACKLE' && d?.tag === 'rookie') {
    return `${d.name} is still learning at this level — caught out by ${a?.name ?? 'the runner'}.`
  }
  if ((input.type === 'TRY' || input.type === 'LINE_BREAK') && a?.tag === 'veteran' && a.attrs.composure >= 85) {
    return `Your veteran ${a.name} steers Queensland around the park and finds the opening.`
  }
  if (input.type === 'ERROR' && a?.tag === 'bolter' && a.attrs.composure < 55) {
    return `${a.name} — the bolter — lets the pressure get to him. Costly.`
  }
  return null
}

function repeatTargetingFraming(input: CommentaryInput, ctx: CommentaryContext): string | null {
  if (!input.defender || !input.channel) return null
  const breakish = input.type === 'MISSED_TACKLE' || input.type === 'LINE_BREAK' || input.type === 'TRY'
  if (!breakish) return null
  if (ctx.channelTargetCount === 3) {
    return `That’s the third time they’ve gone at ${input.defender.name}’s ${CHANNEL_PHRASE[input.channel]} — and again it gives.`
  }
  if (ctx.channelTargetCount >= 5) {
    return `They are living at ${input.defender.name}’s ${CHANNEL_PHRASE[input.channel]} all night now.`
  }
  return null
}

/** The canonical scoreboard phrase used wherever {score} appears (play-by-play + color). */
export function scorePhrase(score: { qld: number; nsw: number }): string {
  return `QLD ${score.qld} - ${score.nsw} NSW`
}

function substitute(template: string, input: CommentaryInput, ctx: CommentaryContext): string {
  return template
    .replace(/\{attacker\}/g, input.attacker?.name ?? '')
    .replace(/\{defender\}/g, input.defender?.name ?? '')
    .replace(/\{playerOff\}/g, input.playerOff?.name ?? '')
    .replace(/\{playerOn\}/g, input.playerOn?.name ?? input.attacker?.name ?? '')
    .replace(/\{club\}/g, input.attacker?.club ?? '')
    .replace(/\{channelPhrase\}/g, CHANNEL_PHRASE[input.channel ?? 'MIDDLE'])
    .replace(/\{side\}/g, input.side === 'QLD' ? 'Maroons' : 'Blues')
    .replace(/\{score\}/g, scorePhrase(ctx.score))
    .replace(/\{ground\}/g, ctx.venue?.groundShort ?? 'Suncorp')
    .replace(/\{city\}/g, ctx.venue?.city ?? 'Brisbane')
    .replace(/\{gameLabel\}/g, ctx.gameLabel ?? 'Origin I')
}

function pickTemplate(input: CommentaryInput, ctx: CommentaryContext): string {
  const pool = TEMPLATES[input.type]
  // (Pass 2) Pre-draw kick-type filter — for a KICK event, narrow to the lines written for this
  // kickType plus the untyped universal fallbacks; a line with a *different* kickType is dropped. This
  // runs BEFORE the tag filter and BEFORE the single rng draw (exactly like the tag filter), so the
  // draw count is unchanged. For non-KICK events `kickType` is undefined on every template, so this is
  // a no-op pass-through. If a kickType somehow has no matching line, fall back to the full pool.
  let typePool = pool
  if (input.type === 'KICK') {
    const byType = pool.filter((t) => t.kickType === undefined || t.kickType === input.kickType)
    if (byType.length > 0) typePool = byType
  }
  // Pre-draw, pure tag filter — narrows the pool to context-appropriate phrasings. 'any' is always
  // in the active set, and every pool has ≥1 'any' template, so `filtered` is never empty.
  const tags = activeTags(ctx)
  const filtered = typePool.filter((t) => t.tags.some((tag) => tags.has(tag)))
  const effective = filtered.length > 0 ? filtered : typePool

  const key = input.type
  const last = ctx.lastTemplateIndex.get(key)
  // Exactly ONE rng() draw — identical draw count to the pre-tag implementation, so the match
  // event stream stays byte-identical. Repeat-avoidance runs over the filtered subset.
  let idx = Math.floor(ctx.rng() * effective.length)
  if (effective.length > 1 && idx === last) {
    idx = (idx + 1) % effective.length
  }
  ctx.lastTemplateIndex.set(key, idx)
  return effective[idx].text
}

export function renderCommentary(input: CommentaryInput, ctx: CommentaryContext): string {
  // COLOR is rendered + appended by simulateMatch via colorCommentary.ts and never reaches here. The
  // exhaustive TEMPLATES.COLOR entry is a stub, so guard rather than draw against an empty pool.
  if (input.type === 'COLOR') return ''
  const framing = repeatTargetingFraming(input, ctx) ?? tagFraming(input)
  let line = framing ?? substitute(pickTemplate(input, ctx), input, ctx)

  if (input.type === 'TRY') {
    const partisan = input.side === 'QLD' ? QLD_TRY_LIFT : NSW_TRY_GROAN
    const idx = Math.floor(ctx.rng() * partisan.length)
    // Substitute so the venue tokens (e.g. {ground} in the NSW groan) resolve per venue.
    line = `${line} ${substitute(partisan[idx], input, ctx)}`
  } else if (DRAMA_TYPES.has(input.type)) {
    // The event befalls input.side; bad luck for NSW is good news for the Maroons.
    const partisan = input.side === 'NSW' ? DRAMA_AGAINST_NSW : DRAMA_AGAINST_QLD
    const idx = Math.floor(ctx.rng() * partisan.length)
    line = `${line} ${substitute(partisan[idx], input, ctx)}`
  }
  return line
}
