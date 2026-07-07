import type { MatchResult } from '../engine'
import type { Storyline } from './storylines'

/**
 * The Back Page — tabloid pools for the splash. Before kick-off the paper takes a POSITION on the
 * boldest selection call (backs it or savages it, seeded pick); after full-time the result settles
 * the argument: vindication or the pile-on. Authored pools, seeded picks, zero rng draws from the
 * match stream — the speeches.ts pattern. Surname-first tabloid voice, always about the COACH: the
 * media doesn't blame a rookie for being picked, it blames Slater for picking him.
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
    { stance: 'savages', headline: 'SLATER AXES {player}', standfirst: 'Dumping {player} on the eve of battle is a call that will follow Billy Slater forever — the wrong way, most likely.' },
    { stance: 'backs', headline: 'BILLY SWINGS THE AXE', standfirst: '{player} makes way, and this column says good judges pick form over reputation. Brave. Right.' },
    { stance: 'savages', headline: 'MAROON MADNESS', standfirst: 'No {player}? Queensland dressing rooms have mutinied over less. Slater owns whatever happens now.' },
  ],
  'recalled-outcast': [
    { stance: 'savages', headline: 'DESPERATION RECALL', standfirst: 'Slater has gone back to {player} — a man the selectors binned for a reason. Nostalgia is not a spine.' },
    { stance: 'backs', headline: 'THE PRODIGAL MAROON', standfirst: '{player} is back in Maroon, and about time. Class is permanent; Slater just remembered it.' },
    { stance: 'savages', headline: 'BILLY HITS REWIND', standfirst: 'Recalling {player} smells like a coach out of ideas. The Blues will be licking their lips.' },
  ],
  'blooded-rookie': [
    { stance: 'savages', headline: 'BOY AMONG MEN', standfirst: 'Slater is throwing {player} into the cauldron with nothing but a debut jersey. Origin eats rookies.' },
    { stance: 'backs', headline: 'THE KID GETS HIS SHOT', standfirst: '{player}, uncapped and unbothered — exactly the kind of pick Queensland folklore is built on.' },
    { stance: 'backs', headline: 'BLOOD THE KID', standfirst: 'Slater has never feared youth — he was one. {player} starts, and this paper is here for it.' },
  ],
  'kept-faith': [
    { stance: 'savages', headline: 'LOYALTY OR BLINDNESS?', standfirst: '{player} keeps his jersey off the back of club form that would embarrass a reserve grader. Mates picking mates.' },
    { stance: 'backs', headline: 'BILLY KEEPS THE FAITH', standfirst: '{player} is short of a gallop, but Origin players win Origin games. Slater knows what he has.' },
  ],
  'gamble-doubtful': [
    { stance: 'savages', headline: 'WALKING WOUNDED', standfirst: '{player} is one tackle from the casualty ward and Slater has named him anyway. If it goes wrong, it is on the coach.' },
    { stance: 'backs', headline: 'PATCHED UP AND PICKED', standfirst: 'A hobbled {player} is still worth more than most men fully fit. Calculated risk from Slater.' },
  ],
  'positional-shock': [
    { stance: 'savages', headline: 'SQUARE PEG SELECTION', standfirst: '{player} at {note}? Slater is playing fantasy football with a state’s heart.' },
    { stance: 'backs', headline: 'THE SWITCH', standfirst: '{player} shifts to {note}, and it is the kind of left-field call that wins series — or costs coaches jobs.' },
  ],
}

/** Quiet week: no bold call, so the paper writes the mood instead. Stance is nominal. */
const PRE_QUIET: Take[] = [
  { stance: 'backs', headline: 'STEADY AS SHE GOES', standfirst: 'No shocks, no gambles — Slater has named the side everyone expected. The footy will have to make the news.' },
  { stance: 'backs', headline: 'NO NOTES, BILLY', standfirst: 'A settled Queensland sheet. The papers hate it; the dressing room loves it.' },
]

/** Post-game resolutions, keyed by stance × whether QLD won. Always about the coach's call. */
const POST: Record<'backs' | 'savages', Record<'win' | 'loss', string[]>> = {
  savages: {
    // The paper attacked the call and QLD won — it eats its words (grudgingly).
    win: [
      'BILLY’S MASTERSTROKE — this column said the {player} call was madness. Queensland won. We’ll cop that.',
      'SLATER 1, PRESS BOX 0 — the {player} gamble paid, and somewhere Billy is not even smiling about it.',
    ],
    // The paper attacked the call and QLD lost — the pile-on.
    loss: [
      'TOLD YOU SO — the {player} call blew up exactly as predicted, and Slater has nowhere to hide.',
      'BILLY’S BLUNDER — you cannot make the {player} call and lose. The coach wears this one alone.',
    ],
  },
  backs: {
    win: [
      'VINDICATED — this paper backed the {player} call, Queensland delivered, and Slater’s aura grows.',
      'THE CALL THAT WON IT — {player} was Slater’s bet, and the old fullback still reads the game better than anyone.',
    ],
    loss: [
      'RIGHT CALL, WRONG NIGHT — we backed the {player} pick and still do. The other sixteen let Billy down.',
      'NO REGRETS, NO SHIELD — the {player} call was brave. Bravery does not show up on the scoreboard.',
    ],
  },
}

const POST_QUIET: Record<'win' | 'loss', string[]> = {
  win: ['BUSINESS AS USUAL — no drama in selection, none on the field. Queensland win, Slater shrugs.'],
  loss: ['FLAT TRACK, FLAT FOOTY — a safe team sheet and a sorry result. The knives will want a name by Thursday.'],
}

function render(template: string, story: Storyline | undefined): string {
  return template
    .replaceAll('{player}', story?.playerName ?? 'the side')
    .replaceAll('{note}', story?.note ?? '')
}

/** The pre-game splash — the paper takes its position on the boldest call. Seeded, deterministic. */
export function preGameBackPage(story: Storyline | undefined, seed: number): BackPage {
  const pool = story ? PRE_TAKES[story.kind] : PRE_QUIET
  const take = pool[(seed >>> 4) % pool.length]
  return {
    paper: 'THE BACK PAGE',
    headline: render(take.headline, story),
    standfirst: render(take.standfirst, story),
    stance: take.stance,
  }
}

/** The morning-after verdict — the position, settled by the result. */
export function postGameBackPage(
  story: Storyline | undefined,
  stance: 'backs' | 'savages',
  result: MatchResult,
  seed: number,
): BackPage {
  const won = result.winner === 'QLD'
  const pool = story ? POST[stance][won ? 'win' : 'loss'] : POST_QUIET[won ? 'win' : 'loss']
  return {
    paper: 'THE BACK PAGE',
    headline: render(pool[(seed >>> 6) % pool.length], story),
    standfirst: '',
    stance,
  }
}
