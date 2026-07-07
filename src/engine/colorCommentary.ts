// Live COLOR commentary — the analysts' replies that land right after a big play. This is the second
// voice of the broadcast (the callers do play-by-play in commentary.ts). It is driven ENTIRELY by a
// SEPARATE salted `colorRng` passed in from simulateMatch — it NEVER touches the match `rng`, so it
// cannot perturb the per-play draw count and the play stream stays byte-identical.
//
// Each persona gets ~4-6 authentically in-voice lines per moment. Only {attacker}/{defender}/{score}
// tokens are used, and they're substituted + guarded here so no unsubstituted {token} ever leaks.

import type { PersonaId } from './personas'
import { PERSONAS } from './personas'
import { scorePhrase } from './commentary'
import type { Rng } from './rng'

/** The narrative beats that can draw a color reply. */
export type ColorMoment = 'try' | 'break' | 'middle' | 'discipline' | 'swing' | 'late'

/** Tokens a color line may reference. Substituted + guarded so nothing leaks unrendered. */
export interface ColorVars {
  attacker?: string
  defender?: string
  score: { qld: number; nsw: number }
}

/**
 * Per-persona, per-moment line pools. Voices, per personas.ts:
 *  - gould (Gus):    big-picture, blunt, contrarian — opens "I'll tell you what".
 *  - johns (Joey):   halves play & tactical detail — ruck speed, kicking game, the spine.
 *  - smith (Cam):    forwards / dummy-half / game-management — dry, understated, reads the middle.
 *  - fittler (Freddy): laconic, instinctive — feel of the game over the stat sheet.
 *  - lockyer (Locky): measured, Maroons lens — calm, respectful, the long game.
 *  - thurston (JT):  halfback craft, warm, all-Queensland heart — emotional, generous.
 */
export const COLOR_LINES: Record<ColorMoment, Partial<Record<PersonaId, string[]>>> = {
  // A try has just been scored. QLD-scoring leans JT/Locky; NSW-scoring leans Joey; Gus/Freddy spice.
  try: {
    thurston: [
      'Ohh I love that, mate! {attacker} just backed himself and the place has gone up — {score}.',
      'That’s Queensland footy right there — {attacker} wanted it more than the bloke marking him. Beautiful.',
      'You can feel it through the screen — {attacker} over, the Maroons roaring, that’s what it’s all about.',
      'Goosebumps, mate — you can see what it means to {attacker}. That’s why we love this game.',
      'That’s big-game temperament — {attacker} stands up when the jersey’s heaviest. Wonderful.',
      'He dragged {defender} over with him! {attacker} just would not be stopped. {score}.',
    ],
    lockyer: [
      'Composed finish from {attacker} — they built the pressure, took their time, and it told. {score}.',
      'That’s the reward for patience. {attacker} just had to be there, and he was. Smart, clean, four points.',
      'No panic in that, just good process from {attacker}. {defender} had nowhere to go in the end.',
      'Built over four tackles, finished in one — {attacker} the beneficiary of a really mature set.',
      'They squeezed the field, took the percentages, and {attacker} gets the simple one. That’s Origin footy.',
      'Calm under it all — {attacker} doesn’t force it, just waits for the gap and takes it.',
    ],
    johns: [
      'Tactically that was set up two plays earlier — by the time {attacker} got it, {defender} was already beaten. {score}.',
      'Lovely shape in the attack — they fixed the man inside and {attacker} had the overlap to finish. Clinical.',
      'That’s what a good kicking game buys you — field position, then {attacker} cashes it in.',
      'Second-man play — the decoy holds {defender} and {attacker} runs onto a flat ball. Beautiful design.',
      'Quick play-the-ball, numbers on the edge, and {attacker} only has to catch and pass. Ten out of ten.',
      'They’ve targeted that edge all night — pull {defender} in, then go round him. {attacker} finishes it off.',
    ],
    gould: [
      'I’ll tell you what — {defender} has to own that one. {attacker} did nothing special, the read was just wrong. {score}.',
      'I’ll tell you what, that’s a soft try to give up. {attacker} will take it, but the defence handed it over.',
      'I’ll tell you what — you switch off for one play in Origin and {attacker} makes you pay. There it is.',
      'I’ll tell you what — the markers were asleep, {attacker} scoots out of dummy-half, and it’s {score}. Switch on.',
      'I’ll tell you what, no one talked in that line. {attacker} runs through a hole you could drive a bus through.',
      'I’ll tell you what — they’ll be filthy with that. {attacker} barely had to beat a man. Poor stuff defensively.',
    ],
    fittler: [
      'Yeah, that one just felt like it was coming. {attacker} on the end of it — momentum’s a real thing.',
      'Good finish. {attacker} read the bounce, backed his instinct, done. {score}.',
      'You could see {defender}’s legs were gone. {attacker} only had to ask the question.',
      'Yeah, the body language gave it away — {attacker} just rode the momentum over.',
      'Simple, really. {attacker} backed himself, didn’t overthink it. {score}.',
      'That edge had been creaking — {attacker} just gave it the final nudge.',
    ],
  },

  // A line break — the defence has been split open. Same QLD/NSW lean as tries.
  break: {
    johns: [
      'There’s your ruck speed — quick play-the-ball and {defender} is flat-footed, {attacker} straight through.',
      'That’s a spine working in sync. {attacker} hits the gap because the man inside held {defender} a beat too long.',
      'Watch the footwork — {attacker} fixes one defender and the line folds. That’s halves craft.',
      'Ruck speed again — {attacker} hits it before the line’s set. You can’t defend that.',
      'They’ve isolated {defender} on the edge and gone right at him. {attacker} the obvious out.',
    ],
    thurston: [
      'Whoa! {attacker}’s got the wheels, mate — once he’s through that hole it’s panic stations for the cover.',
      'That’s electric. {attacker} just backed his speed and {defender} had no chance. Love it.',
      'Look at the gas, mate! Once {attacker} is in the clear there’s no catching him.',
      'That’s the line break that wins games — {attacker} backs himself and the cover’s in all sorts.',
    ],
    lockyer: [
      'Clean break, but the job’s only half done — {attacker} has to make it count now. Good support’s the key.',
      'They’ve been threatening that all night and {attacker} finally cracks it. Now it’s about the finish.',
      'Half the work done — now it’s the support play. {attacker} needs an arm on his inside.',
      'That’s the crack they were after. {attacker} through; the composure to finish it is everything now.',
    ],
    fittler: [
      'Yeah, you felt that coming — {attacker} just sniffed the space and went.',
      'No hesitation. {attacker} saw the gap and trusted it. That’s instinct.',
      'The line was a yard too flat and {attacker} made them pay. Simple read.',
      'That’s what fatigue does — {defender} reaches, and {attacker} is gone.',
    ],
    smith: [
      'That break starts in the middle — tire the big men out and the edge opens up for {attacker}. Simple as that.',
      'Dummy-half’s done his job there. Quick ball, {defender} reaching, and {attacker} is gone.',
    ],
    gould: [
      'I’ll tell you what — {defender} jammed in when he should’ve stayed square, and {attacker} walked through the gate.',
      'I’ll tell you what, that’s a coaching nightmare — nobody talked, {attacker} ran through a hole you could park a bus in.',
      'I’ll tell you what — that’s a busted read. {attacker} through, cover scrambling, {score}.',
      'I’ll tell you what, you can’t shoot out of the line like that in Origin. {attacker} thanks {defender} for it.',
    ],
  },

  // Repeated middle-targeting (channelTargetCount >= 3) — Cam Smith's wheelhouse.
  middle: {
    smith: [
      'They keep going back through the middle at {defender} and it keeps giving — you have to wonder when they’ll change it up.',
      'This is game management 101 — soften the middle, wear {defender} down, and the edges open up later. Patient stuff.',
      'Dry truth — {defender}’s middle is leaking, and good sides smell that and just keep coming. {score}.',
      'Win the ruck, win the game. They’re bossing {defender} through the guts and the platform’s only getting better.',
      'Same shop, same result — they keep ordering off {defender} through the middle and it keeps arriving.',
      'Forward-pack footy, this. Grind {defender} down, get the quick ruck, and the back end of the set is theirs.',
      'You watch the play-the-ball speed either side of {defender} — that’s the whole game, right there.',
      'No tricks in that, just intent. Run hard at {defender}, get the arms moving backwards, go again.',
      'The bench matters now. {defender} has made a mountain of tackles and the next carry knows it.',
    ],
    johns: [
      'The middle’s where it’s being won — {defender} can’t get a quick play-the-ball and it’s killing the line speed.',
      'They’ve identified {defender} as the soft shoulder through the middle and they are not going to stop. Smart footy.',
      'No line speed because {defender} can’t get off the deck — that’s how you control the middle.',
      'Field position’s built right here. Dominate {defender} through the guts and the kick comes off the back of it.',
      'Every carry at {defender} buys the halves another metre of time. That’s what the grind is FOR.',
      'It’s not glamorous but it’s Origin — win the collision on {defender} and everything downstream gets easy.',
    ],
    gould: [
      'I’ll tell you what — {defender} is getting carted through the middle and nobody’s helping him. Fix it or it’s over.',
      'I’ll tell you what — if I’m the coach, {defender} is coming off. They’re living through that channel.',
      'I’ll tell you what, that’s embarrassing for the middle. {defender} needs help and he’s getting none. {score}.',
      'I’ll tell you what — you can’t hide a tired man in Origin. They’ve found {defender} and they’re not leaving.',
      'I’ll tell you what, someone in that middle has to put their hand up, because {defender} is out on his feet.',
    ],
  },

  // Discipline — sin bin / send-off / failed HIA. Gus primary, Freddy secondary.
  discipline: {
    gould: [
      'I’ll tell you what — that’s just dumb. {defender} has let his side down badly there, and now they’re a man short. {score}.',
      'I’ll tell you what, you cannot do that in an Origin decider. {defender} has cost his team, simple as that.',
      'I’ll tell you what — undisciplined, unnecessary, and it might just decide the match. {defender} will hear about it.',
      'I’ll tell you what — selfish, that. {defender} has put himself before the team and now they all pay. {score}.',
      'I’ll tell you what, that’s ten minutes that could lose an Origin. {defender} has to be smarter than that.',
      'I’ll tell you what — the referee didn’t do that TO him. {defender} did it to himself, and his mates pay the bill.',
      'I’ll tell you what, discipline is a skill, same as passing. {defender} just failed the test with the game on the line.',
      'I’ll tell you what — twelve men in Origin is an eternity. Every one of those minutes will feel like ten.',
    ],
    fittler: [
      'Yeah, that’s a tough one for {defender} — heat of the moment, but you’ve gotta keep your head. Hurts the side.',
      'No room for that. {defender} knows it the second it happens — now his teammates wear the next ten minutes.',
      'That changes the whole feel of the game. {defender} off, and you can sense the momentum shift already.',
      'You can’t give that away. {defender} switched off for a second and the whole shape changes.',
      'Tough watch for the teammates — {defender} off, and now they dig in a man down.',
      'The walk off tells you everything — {defender} knows exactly what he’s done to his side.',
      'Now you find out who your leaders are. A man down, everything on, no hiding.',
    ],
    johns: [
      'That’s a body blow — {defender} gone, and now the spine has to reorganise the whole defensive structure on the fly.',
      'Structurally it’s a nightmare — lose {defender} and someone’s covering two jobs in the line.',
      'That’s where games slip — short a man, the edges get exposed and the other side will hunt it.',
      'Watch the markers now — a man short, they can’t commit two, and the dummy-half will feast on it.',
      'Smart sides go straight at the spot {defender} vacated. The next set tells you if they’ve done their homework.',
    ],
  },

  // Momentum swing — e.g. a 40/20. Joey leads (kicking game is his wheelhouse); Gus/Freddy laconic.
  swing: {
    johns: [
      'THAT is the kicking game — {attacker} turned defence into attack with one boot. That’s a 40/20, and it’s a weapon.',
      'You don’t see those by accident — {attacker} has practised that 40/20 a thousand times. Field position swings, the whole set flips. {score}.',
      'That’s halves craft right there. {attacker} reads the winger up, rakes it low, and the territory’s gone the other way. Brilliant.',
      'That’s a 40/20 in your back pocket for exactly this moment — {attacker} flips the field and the set with it.',
      'Pressure-release valve, that. {attacker} kicks them out of trouble and into attack in one motion. {score}.',
      'Inches from the sideline — {attacker} took the risk on and the reward is a full set on their line.',
      'That’s hours on the training paddock cashing in — {attacker} saw the winger creep and punished it.',
    ],
    gould: [
      'I’ll tell you what — the whole complexion of this game just changed off one kick. You can feel it. {score}.',
      'I’ll tell you what, momentum in Origin is a living thing, and {attacker} has just swung it. Big moment, this.',
      'I’ll tell you what — momentum just changed sides, and you didn’t need the scoreboard to see it.',
      'I’ll tell you what, that’s the play of a side that believes. {attacker} just seized it.',
      'I’ll tell you what — for ten minutes nothing’s gone right for them, and one act from {attacker} fixes all of it.',
      'I’ll tell you what, watch the defensive line on the next set. That kick just put doubt in every one of them.',
    ],
    fittler: [
      'Feel that? The whole thing’s just tilted. One boot from {attacker} and the body language has flipped.',
      'This is the bit where Origin games get decided — {attacker} just bought his side a free set. {score}.',
      'Yeah, the whole ground felt that. One boot and the momentum’s flipped.',
      'That’s the moment. {attacker} bought a set, bought belief. {score}.',
      'Watch the forwards jog back — one kick from {attacker} and suddenly they’re running like it’s round one.',
    ],
    lockyer: [
      'This is the pressure cooker now — and {attacker} just answered it with a perfect kick. Composure wins from here. {score}.',
      'That’s the value of a cool head — {attacker} picks the exact moment the game needed flipping, and flips it.',
      'Territory is oxygen in Origin, and {attacker} just took theirs away in one play. {score}.',
    ],
  },

  // Late tension — last ten, on the line (e.g. a field goal). Freddy/Gus laconic; Locky measured.
  late: {
    gould: [
      'I’ll tell you what — this is where reputations are made. {attacker} just nailed the one-pointer, {score}, and the clock’s the enemy now.',
      'I’ll tell you what, that field goal might be the whole game. {attacker} backed himself and one mistake from here decides it.',
      'I’ll tell you what — pressure does funny things, and {attacker} just looked the calmest man in the building.',
      'I’ll tell you what, one point looms enormous now. {attacker} has nerve, and the rest play catch-up. {score}.',
      'I’ll tell you what — everyone in the ground knew it was coming, and {attacker} still got it done. That’s class.',
      'I’ll tell you what, they’ll replay that kick for years if this scoreline holds. {score}.',
    ],
    fittler: [
      'Squeaky-bum time now. {score}. {attacker} held his nerve and took the point — that’s the difference.',
      'You don’t coach that bit — {attacker} just calmly dropped one over. Pure instinct. Brilliant theatre.',
      'Cool as you like. {attacker} took the point and let the scoreboard do the talking.',
      'That’s the difference between the good and the great — {attacker} didn’t flinch.',
      'Everyone’s heart rate just went up except {attacker}’s. That’s why he takes those.',
    ],
    lockyer: [
      'One point can win an Origin — ice in the veins from {attacker}. That’s the whole game in one calm kick. {score}.',
      'Hold the footy, complete your sets, take the point when it’s on — {attacker} just did exactly that. {score}.',
      'Take the point, trust the defence — {attacker} just played the percentages perfectly. {score}.',
      'Origin is won in moments like this, and {attacker} embraced it. No fuss, just nerve.',
      'You plan for that moment all week, and {attacker} executed it exactly as drawn. Composure. {score}.',
      'The easy thing is to force a try that isn’t there. {attacker} took the smart point instead — that’s experience.',
    ],
    thurston: [
      'Oh, my heart, mate! {attacker} with the biggest kick of his life and it sails over. {score}!',
      'That’s what you dream about as a kid in the backyard — {attacker} just lived it. Goosebumps.',
    ],
  },
}

/** Substitute the small color token set and strip any stray token so nothing unrendered leaks. */
function renderColorLine(template: string, vars: ColorVars): string {
  return template
    .replace(/\{attacker\}/g, vars.attacker ?? 'the runner')
    .replace(/\{defender\}/g, vars.defender ?? 'the defender')
    .replace(/\{score\}/g, scorePhrase(vars.score))
    .replace(/\{[a-zA-Z]+\}/g, '')
    .trim()
}

export interface ColorPick {
  personaId: PersonaId
  persona: string
  personaRole: string
  line: string
}

/**
 * Deterministically choose a persona (from `candidates`, narrowed to those with lines for `moment`)
 * and one of their lines, drawing ONLY from the passed-in salted `colorRng`. Exactly TWO colorRng()
 * draws (persona, then line); both are spent on a real selection so density stays predictable. If no
 * candidate has lines for the moment, returns null (caller skips — no event appended).
 */
export function pickColor(
  colorRng: Rng,
  moment: ColorMoment,
  candidates: PersonaId[],
  vars: ColorVars,
): ColorPick | null {
  const pool = COLOR_LINES[moment]
  const eligible = candidates.filter((id) => pool[id] && pool[id]!.length > 0)
  if (eligible.length === 0) return null

  const personaId = eligible[Math.floor(colorRng() * eligible.length)]
  const lines = pool[personaId]!
  const line = renderColorLine(lines[Math.floor(colorRng() * lines.length)], vars)
  const p = PERSONAS[personaId]
  return { personaId, persona: p.name, personaRole: p.role, line }
}
