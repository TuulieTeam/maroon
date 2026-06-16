import { makeRng } from './rng'
import type { PreMatchSpeech, SeriesStakes } from './types'

/**
 * Phil "Gus" Gould-style pre-game addresses, surfaced on the pre-game screen as the emotional
 * send-off right before kick off. Each is tagged with a MOOD so the pick fits the moment — a finale
 * address for a decider, defiance when the backs are to the wall, a general fire-up otherwise. Within
 * the matching mood the choice is seeded off the match seed (salted, independent of the booth lines),
 * so it is deterministic and reproducible. A few bodies that named a specific game have been made
 * game-agnostic so any address reads correctly in any slot.
 */

const SPEECH_SALT = 0x5f3759df

type SpeechMood = 'opener' | 'pressure' | 'decider'

interface SpeechDef extends PreMatchSpeech {
  mood: SpeechMood
}

const SPEECHES: SpeechDef[] = [
  // ---- OPENER — general fire-up (series start, can-clinch, dead-rubber-up, no series) ----
  {
    title: 'The First Hit',
    mood: 'opener',
    lines: [
      'Tonight, it begins again.',
      'All the talk is finished. The predictions, the pressure, the noise, the old arguments dragged out and dusted off for one more winter.',
      'But Origin has never cared much for talk.',
      'It asks one question.',
      'When the whistle goes, who are you?',
      'Not who you were last year. Not what they said about you in the papers. Not what the experts believe.',
      'Who are you when the first tackle rattles the ribs?',
      'Who are you when the line is coming fast?',
      'Who are you when your state needs you?',
      'This is not just another night.',
      'This is the first hit.',
    ],
  },
  {
    title: 'The Jersey Remembers',
    mood: 'opener',
    lines: [
      'They say every new series starts fresh.',
      'That sounds nice.',
      'But the jersey remembers.',
      'It remembers the tackles that hurt. The tries that should never have been scored. The faces in the sheds after a loss. The silence on the bus home.',
      'And it remembers the men who stood tall when everything else was shaking.',
      'Tonight, a new chapter opens. New players. New pressure. Same old fire.',
      'Because this contest was never built on comfort. It was built on rivalry, on pride, on the belief that your state is worth bleeding for.',
      'So wear it properly.',
      'Because the jersey remembers everything.',
    ],
  },
  {
    title: 'No Easy Metres',
    mood: 'opener',
    lines: [
      'There are no easy metres here.',
      'Not tonight.',
      'Every inch will be argued over. Every run will be answered. Every mistake will be remembered by people who have waited twelve months to see if you are the real thing.',
      'Origin does not ask for perfection.',
      'It asks for honesty.',
      'Can you keep going when the easy stuff disappears?',
      'Can you stand in the line when the big men are coming?',
      'Can you make the hard choice when your body is begging for the soft one?',
      'That is what begins tonight.',
      'Not just a series.',
      'A search.',
      'A search for the team willing to pay the highest price.',
    ],
  },
  {
    title: 'Old Rivalry, New Scars',
    mood: 'opener',
    lines: [
      'The rivalry is old.',
      'But the scars are always new.',
      'Every generation gets its turn. Every player thinks they understand it until the first collision teaches them there are no passengers here.',
      'This is not club football with brighter lights.',
      'This is something heavier.',
      'It is the sound of a state holding its breath. It is the smell of wet grass and winter air. It is the knowledge that one missed tackle can live longer than a hundred good ones.',
      'Tonight, they do not just represent where they are from.',
      'They represent everyone who still argues about where they belong.',
      'The rivalry is old.',
      'But tonight, it gets hungry again.',
    ],
  },
  {
    title: 'The Middle Chapter',
    mood: 'opener',
    lines: [
      'This is the dangerous one.',
      'It is where confidence can become arrogance. Where desperation can become power. Where the series can turn so quickly that the team smiling at halftime is staring at the floor by full-time.',
      'This is the middle chapter.',
      'And middle chapters are messy.',
      'They test belief. They expose weakness. They ask whether the early promise was the start of something real or just one good night under bright lights.',
      'No one wins Origin with memories.',
      'You win it again. Set by set. Tackle by tackle. Moment by moment.',
      'Tonight, the series does not end.',
      'It tilts.',
      'And one side is about to feel the ground move.',
    ],
  },
  {
    title: 'Earn the Right',
    mood: 'opener',
    lines: [
      'Nobody owns Origin.',
      'Not last year’s winners. Not the favourites. Not the loudest fans. Not the side with the better headlines.',
      'You earn it.',
      'Every series. Every game. Every set.',
      'You earn it when you chase the kick no one thinks you will reach. You earn it when you get up slowly and still put your hand up for the next carry. You earn it when the scoreboard turns against you and your eyes do not drop.',
      'Tonight is not about reputation.',
      'Reputation stands outside the fence.',
      'In here, under these lights, the only thing that matters is what you are willing to do now.',
      'So go on then.',
      'Earn it.',
    ],
  },
  {
    title: 'The Game Within the Game',
    mood: 'opener',
    lines: [
      'Everyone sees the scoreboard.',
      'But Origin is won in places the scoreboard cannot show.',
      'The extra step in the chase. The inside shoulder covered. The tired forward taking one more carry because someone had to. The half-second decision that saves a try and maybe a series.',
      'That is the game within the game.',
      'It is not always pretty. It is not always noticed. But it is always there.',
      'And tonight, that is where this one will be decided.',
      'Not by the player who wants the moment most.',
      'By the player who does the small thing right when everything feels too big.',
      'That is Origin.',
      'The details have teeth.',
    ],
  },

  // ---- PRESSURE — defiance, backs to the wall (must-win, down in a dead rubber) ----
  {
    title: 'Answer Back',
    mood: 'pressure',
    lines: [
      'The last time out told a story.',
      'Maybe it was glory. Maybe it was pain. Maybe it was a reminder that Origin does not hand out second chances gently.',
      'But tonight, the story is not finished.',
      'Tonight is where a team finds its voice.',
      'Because in this arena, losing does not define you. Silence does. Staying down does. Letting another jersey walk over yours and call it destiny does.',
      'So now comes the answer.',
      'Not with speeches. Not with promises. With shoulders. With effort. With the kind of courage you cannot fake once the legs are gone and the lungs are burning.',
      'Tonight, they do not need excuses.',
      'They need a response.',
    ],
  },
  {
    title: 'The Longest Night',
    mood: 'pressure',
    lines: [
      'There is a moment in every Origin game when talent stops being enough.',
      'The set starts deep in your own end. The crowd is screaming. The body wants rest. The mind starts asking for mercy.',
      'That is when Origin really begins.',
      'Not in the highlights. Not in the clean breaks or the fancy passes.',
      'It begins in the ugly moments. The repeat efforts. The scramble. The chase no one sees until the try is saved by fingertips and faith.',
      'Tonight will test them.',
      'It always does.',
      'And by the end, one team will know they gave everything.',
      'The other will know they gave something more.',
    ],
  },
  {
    title: 'Backs to the Wall',
    mood: 'pressure',
    lines: [
      'There is something dangerous about a team with its back to the wall.',
      'No room to retreat. No space for doubt. No comfort left to protect.',
      'Just the truth.',
      'Tonight, one side walks in knowing the edge is right behind them. One more loss and the series is gone. The papers will be brutal. The questions will be sharp. The summer will be long.',
      'But that is the gift of pressure.',
      'It strips everything away except what matters.',
      'Pride. Trust. Effort. Belief.',
      'If they want this series to live, they cannot just play better.',
      'They have to fight like the whole thing is breathing through them.',
      'Because tonight, it is.',
    ],
  },

  // ---- DECIDER — finale, legacy, the game on the line ----
  {
    title: 'The Decider',
    mood: 'decider',
    lines: [
      'There are games you play.',
      'And then there are games that follow you around for the rest of your life.',
      'This is one of those games.',
      'Every kick, every carry, every desperate hand under the ball near the line. It all matters now.',
      'There is no tomorrow in a decider. No “next week.” No “we’ll fix it at training.”',
      'There is only this field, this crowd, these eighty minutes, and the weight of a jersey that has broken stronger men than most will ever know.',
      'Tonight, one side gets history.',
      'The other gets heartbreak.',
      'And Origin, cruel beautiful thing that it is, will not apologise to either of them.',
    ],
  },
  {
    title: 'For the Ones Watching',
    mood: 'decider',
    lines: [
      'Somewhere tonight, a kid is sitting on the floor in front of the TV, wearing a jersey too big for them.',
      'They do not understand tactics yet. They do not care about completion rates. They just know the colours.',
      'They know who they love.',
      'And they know this game feels different.',
      'That is what these players carry tonight. Not just a football. Not just a series. They carry every backyard dream, every old family argument, every voice yelling at the screen like it can change the result.',
      'Maybe it can.',
      'Because Origin has always belonged to the people watching as much as the players playing.',
      'Tonight, give them something they never forget.',
    ],
  },
  {
    title: 'The Quiet Before',
    mood: 'decider',
    lines: [
      'Listen to it.',
      'That strange silence just before kickoff.',
      'The crowd is loud, but inside the players, there is a quiet place. A place where all the noise fades and the truth walks in.',
      'Did I prepare?',
      'Do I trust the man beside me?',
      'Am I ready for what this game is about to ask?',
      'Because once it starts, there is nowhere to hide.',
      'The ball will find you. The moment will find you. Origin always does.',
      'And when it does, you either shrink from it or step into it.',
      'Tonight, the series waits.',
      'History waits.',
      'And in a few seconds, waiting ends.',
    ],
  },
  {
    title: 'Eighty Minutes From Forever',
    mood: 'decider',
    lines: [
      'Eighty minutes.',
      'That is all that stands between them and forever.',
      'Not forever in headlines. Headlines fade. Not forever in trophies. Trophies gather dust.',
      'Forever in the stories people tell.',
      'Where they were. Who they watched with. The try they still swear was impossible. The tackle that made the room explode. The final siren that turned grown adults into kids again.',
      'That is what waits tonight.',
      'But forever does not come cheap.',
      'It asks for courage when the legs are gone. Calm when the heart is racing. Belief when the scoreboard says maybe not.',
      'Eighty minutes.',
      'And then a lifetime of remembering.',
    ],
  },
  {
    title: 'One Last Time',
    mood: 'decider',
    lines: [
      'For some, this may be the last time.',
      'They may not say it. They may not even know it yet.',
      'But Origin has a way of moving on. New faces arrive. Old warriors disappear. The jersey gets handed over, but the memories stay.',
      'So tonight, play like you understand the privilege.',
      'There are people who would give anything to stand where you stand. To feel that anthem in the chest. To look across and know what is coming. To be trusted with a state’s hope for one more night.',
      'This is not just the end of a series.',
      'It is a chance to leave something behind.',
      'One last time.',
      'Make it worthy.',
    ],
  },
]

/** Which mood fits the situation. Defaults to the general "opener" fire-up when there is no series. */
function moodForStakes(stakes: SeriesStakes | undefined): SpeechMood {
  switch (stakes) {
    case 'G2_MUST_WIN':
    case 'G3_DEAD_RUBBER_QLD_DOWN':
      return 'pressure'
    case 'G3_DECIDER':
    case 'G3_DECIDER_AFTER_DRAW':
      return 'decider'
    default:
      // OPENER, G2_OPEN_AFTER_DRAW, G2_CAN_CLINCH, G3_DEAD_RUBBER_QLD_UP, or no series.
      return 'opener'
  }
}

/**
 * Pick the pre-match address: filter to the mood that fits the stakes, drop any address already shown
 * earlier this series (so none repeats), then choose deterministically off a salted copy of the match
 * seed (never the match stream). If every mood-matched address has been used, fall back to the full
 * mood pool. Returns a plain `PreMatchSpeech`.
 */
export function pickPreMatchSpeech(
  seed: number,
  stakes?: SeriesStakes,
  usedTitles: readonly string[] = [],
): PreMatchSpeech {
  const moodPool = SPEECHES.filter((s) => s.mood === moodForStakes(stakes))
  const fresh = moodPool.filter((s) => !usedTitles.includes(s.title))
  const pool = fresh.length > 0 ? fresh : moodPool
  const rng = makeRng((seed ^ SPEECH_SALT) >>> 0)
  const { title, lines } = pool[Math.floor(rng() * pool.length)]
  return { title, lines }
}
