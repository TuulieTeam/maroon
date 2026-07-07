import type { MatchResult } from '../engine'
import type { Coach } from './coaches'
import type { Storyline } from './storylines'

/**
 * The Back Page — tabloid pools for the splash. Before kick-off the paper takes a POSITION on the
 * boldest selection call (backs it or savages it, seeded pick); after full-time the result settles
 * the argument: vindication or the pile-on. Authored pools, seeded picks, zero rng draws from the
 * match stream — the speeches.ts pattern. Surname-first tabloid voice, always about the COACH: the
 * media doesn't blame a rookie for being picked, it blames the man who picked him — whoever holds
 * the clipboard this era ({COACH}/{coachFull}/{COACHFIRST} tokens, filled at render).
 */
export interface BackPage {
  /** The masthead strapline, e.g. "THE BACK PAGE". */
  paper: string
  headline: string
  standfirst: string
  /** Which way the paper leaned pre-game — settled post-game. */
  stance: 'backs' | 'savages'
}

interface Take {
  stance: 'backs' | 'savages'
  headline: string
  standfirst: string
}

/** {player} = the storyline's man, {note} = extra colour (e.g. position label). */
const PRE_TAKES: Record<Storyline['kind'], Take[]> = {
  'axed-star': [
    { stance: 'savages', headline: '{COACH} AXES {player}', standfirst: 'Dumping {player} on the eve of battle is a call that will follow {coachFull} forever — the wrong way, most likely.' },
    { stance: 'backs', headline: '{COACHFIRST} SWINGS THE AXE', standfirst: '{player} makes way, and this column says good judges pick form over reputation. Brave. Right.' },
    { stance: 'savages', headline: 'MAROON MADNESS', standfirst: 'No {player}? Queensland dressing rooms have mutinied over less. {COACH} owns whatever happens now.' },
  ],
  'recalled-outcast': [
    { stance: 'savages', headline: 'DESPERATION RECALL', standfirst: '{COACH} has gone back to {player} — a man the selectors binned for a reason. Nostalgia is not a spine.' },
    { stance: 'backs', headline: 'THE PRODIGAL MAROON', standfirst: '{player} is back in Maroon, and about time. Class is permanent; {COACH} just remembered it.' },
    { stance: 'savages', headline: '{COACHFIRST} HITS REWIND', standfirst: 'Recalling {player} smells like a coach out of ideas. The Blues will be licking their lips.' },
  ],
  'blooded-rookie': [
    { stance: 'savages', headline: 'BOY AMONG MEN', standfirst: '{COACH} is throwing {player} into the cauldron with nothing but a debut jersey. Origin eats rookies.' },
    { stance: 'backs', headline: 'THE KID GETS HIS SHOT', standfirst: '{player}, uncapped and unbothered — exactly the kind of pick Queensland folklore is built on.' },
    { stance: 'backs', headline: 'BLOOD THE KID', standfirst: '{COACH} backs the kids — always has. {player} starts, and this paper is here for it.' },
  ],
  'kept-faith': [
    { stance: 'savages', headline: 'LOYALTY OR BLINDNESS?', standfirst: '{player} keeps his jersey off the back of club form that would embarrass a reserve grader. Mates picking mates.' },
    { stance: 'backs', headline: '{COACHFIRST} KEEPS THE FAITH', standfirst: '{player} is short of a gallop, but Origin players win Origin games. {COACH} knows what he has.' },
    { stance: 'savages', headline: 'PICKED ON MEMORIES', standfirst: 'Somewhere there is a highlights tape of {player} doing this job. It was not filmed this season. {COACH} presses play anyway.' },
    { stance: 'backs', headline: 'IN {COACHFIRST} WE TRUST', standfirst: 'The stats say drop {player}. The men who have worn the jersey say you never do. {COACH} sided with the jersey.' },
  ],
  'gamble-doubtful': [
    { stance: 'savages', headline: 'WALKING WOUNDED', standfirst: '{player} is one tackle from the casualty ward and {COACH} has named him anyway. If it goes wrong, it is on the coach.' },
    { stance: 'backs', headline: 'PATCHED UP AND PICKED', standfirst: 'A hobbled {player} is still worth more than most men fully fit. Calculated risk from {COACH}.' },
    { stance: 'savages', headline: 'A PRAYER IN STRAPPING TAPE', standfirst: '{player} could not finish a captain’s run and starts an Origin. {COACH} is gambling with a state’s season.' },
    { stance: 'backs', headline: '80 MINUTES OF GUTS', standfirst: 'Half-fit {player} in the trenches beats a fit anybody else. {COACH} picked courage. Queensland approves.' },
  ],
  'positional-shock': [
    { stance: 'savages', headline: 'SQUARE PEG SELECTION', standfirst: '{player} at {note}? {COACH} is playing fantasy football with a state’s heart.' },
    { stance: 'backs', headline: 'THE SWITCH', standfirst: '{player} shifts to {note}, and it is the kind of left-field call that wins series — or costs coaches jobs.' },
    { stance: 'savages', headline: 'POSITION VACANT, APPARENTLY', standfirst: '{player} has barely trained at {note}, let alone played it in a cauldron. {COACH} calls it vision. We call it a punt.' },
    { stance: 'backs', headline: 'GENIUS OR NOTHING', standfirst: 'Moving {player} to {note} is the sort of call they build statues for when it works. {COACH} has never coached scared.' },
  ],
}

/** Quiet week: no bold call, so the paper writes the mood instead. Stance is nominal. */
const PRE_QUIET: Take[] = [
  { stance: 'backs', headline: 'STEADY AS SHE GOES', standfirst: 'No shocks, no gambles — {COACH} has named the side everyone expected. The footy will have to make the news.' },
  { stance: 'backs', headline: 'NO NOTES, {COACHFIRST}', standfirst: 'A settled Queensland sheet. The papers hate it; the dressing room loves it.' },
  { stance: 'backs', headline: 'BORING. GOOD.', standfirst: 'The most dangerous team sheet is the one with nothing to argue about. {COACH} has handed in exactly that.' },
  { stance: 'backs', headline: 'THE QUIET BEFORE', standfirst: 'Seventeen names, zero surprises. If {COACHFIRST} is nervous about anything, it is not his own selections.' },
]

/** Post-game resolutions, keyed by stance × whether QLD won. Always about the coach's call. */
const POST: Record<'backs' | 'savages', Record<'win' | 'loss', string[]>> = {
  savages: {
    // The paper attacked the call and QLD won — it eats its words (grudgingly).
    win: [
      '{COACHFIRST}’S MASTERSTROKE — this column said the {player} call was madness. Queensland won. We’ll cop that.',
      '{COACH} 1, PRESS BOX 0 — the {player} gamble paid, and somewhere {COACHFIRST} is not even smiling about it.',
      'FINE. HE WAS RIGHT. — the {player} pick we torched on Tuesday just helped win an Origin. Column stands corrected, briefly.',
      'HUMBLE PIE, RARE — {COACH} shoved the {player} call down our throats the only way that counts: on the scoreboard.',
    ],
    // The paper attacked the call and QLD lost — the pile-on.
    loss: [
      'TOLD YOU SO — the {player} call blew up exactly as predicted, and {COACH} has nowhere to hide.',
      '{COACHFIRST}’S BLUNDER — you cannot make the {player} call and lose. The coach wears this one alone.',
      'WE WARNED HIM — this paper begged {COACH} to rethink {player}. The scoreboard just filed the same complaint.',
    ],
  },
  backs: {
    win: [
      'VINDICATED — this paper backed the {player} call, Queensland delivered, and {COACH}’s aura grows.',
      'THE CALL THAT WON IT — {player} was {COACH}’s bet, and the old master still reads the game better than anyone.',
      'AS WE SAID — {player} delivered, Queensland won, and this column will now take a modest bow.',
    ],
    loss: [
      'RIGHT CALL, WRONG NIGHT — we backed the {player} pick and still do. The other sixteen let {COACHFIRST} down.',
      'NO REGRETS, NO SHIELD — the {player} call was brave. Bravery does not show up on the scoreboard.',
      'DON’T BLAME THE BOLD BIT — the {player} call was the best thing about a bad night. Look elsewhere for the culprit.',
    ],
  },
}

const POST_QUIET: Record<'win' | 'loss', string[]> = {
  win: [
    'BUSINESS AS USUAL — no drama in selection, none on the field. Queensland win, {COACH} shrugs.',
    'QUIET WEEK, LOUD FOOTY — the sheet made no news and the team made all of it. Tidy night for {COACHFIRST}.',
    'NOTHING TO SEE HERE — except a Queensland win. {COACH} will take boring like this every camp.',
  ],
  loss: [
    'FLAT TRACK, FLAT FOOTY — a safe team sheet and a sorry result. The knives will want a name by Thursday.',
    'SAFE AND SORRY — {COACH} took no risks at the selection table and got nothing back on the field.',
    'THE PRICE OF PREDICTABLE — no bold calls, no spark, no shield tonight. Something has to change, {COACHFIRST}.',
  ],
}

function render(template: string, story: Storyline | undefined, coach: Coach): string {
  return template
    .replaceAll('{player}', story?.playerName ?? 'the side')
    .replaceAll('{note}', story?.note ?? '')
    .replaceAll('{coachFull}', coach.name)
    .replaceAll('{COACHFIRST}', coach.first.toUpperCase())
    .replaceAll('{coachFirst}', coach.first)
    .replaceAll('{COACH}', coach.surname.toUpperCase())
    .replaceAll('{coach}', coach.surname)
}

/** The pre-game splash — the paper takes its position on the boldest call. Seeded, deterministic. */
export function preGameBackPage(story: Storyline | undefined, seed: number, coach: Coach): BackPage {
  const pool = story ? PRE_TAKES[story.kind] : PRE_QUIET
  const take = pool[(seed >>> 4) % pool.length]
  return {
    paper: 'THE BACK PAGE',
    headline: render(take.headline, story, coach),
    standfirst: render(take.standfirst, story, coach),
    stance: take.stance,
  }
}

/** The morning-after verdict — the position, settled by the result. */
export function postGameBackPage(
  story: Storyline | undefined,
  stance: 'backs' | 'savages',
  result: MatchResult,
  seed: number,
  coach: Coach,
): BackPage {
  const won = result.winner === 'QLD'
  const pool = story ? POST[stance][won ? 'win' : 'loss'] : POST_QUIET[won ? 'win' : 'loss']
  return {
    paper: 'THE BACK PAGE',
    headline: render(pool[(seed >>> 6) % pool.length], story, coach),
    standfirst: '',
    stance,
  }
}
