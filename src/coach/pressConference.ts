import type { MatchResult } from '../engine'
import type { Coach } from './coaches'
import type { PressureBand } from './pressure'
import type { Storyline } from './storylines'

/**
 * The post-game press conference — the coach fronts the pack. Non-interactive by design: the
 * spectator stance holds. You made your call at selection; now you watch him defend it. Exchanges
 * are authored pools keyed by result × pressure temperature, with the boldest selection storyline
 * woven in when one exists. Seeded picks, deterministic. {coachFirst} tokens fill for whoever holds
 * the clipboard this era.
 */
export interface PressExchange {
  question: string
  answer: string
}

/** Bands collapse to a temperature — the presser's tone shifts in three steps, not five. */
type Temp = 'calm' | 'tense' | 'siege'

function tempOf(band: PressureBand): Temp {
  if (band === 'untouchable' || band === 'solid') return 'calm'
  if (band === 'simmering') return 'tense'
  return 'siege'
}

const OPENERS: Record<'win' | 'loss', Record<Temp, PressExchange[]>> = {
  win: {
    calm: [
      {
        question: '{coachFirst}, happy with that?',
        answer: 'Happy with the effort. There’s stuff to fix, there always is, but they turned up for each other tonight.',
      },
      {
        question: 'Pretty comfortable watch from the box?',
        answer: 'None of them are comfortable, mate. But the blokes did their jobs, and that’s all we ask.',
      },
    ],
    tense: [
      {
        question: 'That quiet the noise for a week, {coachFirst}?',
        answer: 'I don’t coach for the noise. The players won that, they can enjoy it. We go again Monday.',
      },
      {
        question: 'Some relief in the coaches’ box tonight?',
        answer: 'Relief is for people who doubted the group. I never did. Good win, short memory, next job.',
      },
      {
        question: 'Does a win like that buy you some patience upstairs?',
        answer: 'I don’t count patience, mate, I count performances. That was one. It needs to become three.',
      },
    ],
    siege: [
      {
        question: '{coachFirst} — does that save your job?',
        answer: 'You blokes have been writing my funeral for a month. The team won a footy game. Ask me about them.',
      },
      {
        question: 'A response to the critics tonight?',
        answer: 'The only response that matters is on the scoreboard. Seventeen men gave everything. Write that.',
      },
      {
        question: 'Did the players win that one for you personally?',
        answer: 'They won it for the jersey and for each other. If it helps me too, I’ll take it — but it was never about me.',
      },
      {
        question: 'You looked emotional at full time, {coachFirst}.',
        answer: 'You spend a month getting belted and then watch blokes produce that. Yeah. I’m allowed a moment.',
      },
    ],
  },
  loss: {
    calm: [
      {
        question: 'Where did that get away, {coachFirst}?',
        answer: 'A couple of moments, and Origin is moments. We’ll own it, review it, and be better for it.',
      },
      {
        question: 'Disappointed, or philosophical?',
        answer: 'Both. Disappointed for the group because the effort was there. Philosophical because the fix is obvious.',
      },
      {
        question: 'Anything in that loss that worries you long-term?',
        answer: 'No. Beaten in a game of footy, not in effort or attitude. Those are the ones you can work with.',
      },
    ],
    tense: [
      {
        question: 'The scrutiny is building — fair?',
        answer: 'Scrutiny comes with this jersey. I picked the team, I own the result. The players don’t wear that, I do.',
      },
      {
        question: 'What do you say to fans losing patience, {coachFirst}?',
        answer: 'That I’m losing patience too. Nobody up here is comfortable. We’ll earn their faith back the only way there is.',
      },
      {
        question: 'Two big calls tonight — both backfired?',
        answer: 'Results grade decisions, I get that. I’ll wear the grade. But I’d rather make calls and miss than coach scared.',
      },
    ],
    siege: [
      {
        question: '{coachFirst}, have you spoken to the board?',
        answer: 'I speak to the board every week. My job is this team, and I’ll do that job for as long as I have it.',
      },
      {
        question: 'Is your position untenable after that?',
        answer: 'People have written me off my whole footballing life. I’ll turn up Monday. Next question.',
      },
      {
        question: 'Was that performance a group that’s stopped listening?',
        answer: 'Say that to the blokes with ice on every joint in that shed. They haven’t stopped anything. Neither have I.',
      },
      {
        question: 'How do you walk into that dressing room now, {coachFirst}?',
        answer: 'Through the front door, same as always. You don’t hide from your own men after a loss. That’s the job.',
      },
    ],
  },
}

/** The storyline follow-up — the press always circles back to the bold call. {player} woven in. */
const FOLLOW_UPS: Record<'win' | 'loss', string[]> = {
  win: [
    'Q: The {player} call — vindicated? · A: I don’t pick teams to win arguments. {player} did his job, that’s the end of it.',
    'Q: Did {player} repay you tonight? · A: He repaid his teammates. I just wrote the name down.',
    'Q: Everyone had an opinion on {player} this week. · A: And he answered every one of them without saying a word. That’s footy.',
    'Q: Was there a point tonight you knew {player} was right? · A: At training last Tuesday. Tonight you all just caught up.',
  ],
  loss: [
    'Q: Do you regret the {player} call? · A: I’d make it again tomorrow. The result doesn’t change what I saw at training.',
    'Q: Was {player} the mistake tonight? · A: If you want a name for the loss, use mine. Not his.',
    'Q: Does {player} keep his spot after that? · A: Team’s picked on Tuesday, same as every week. He’ll be judged on more than one night.',
    'Q: Did the {player} gamble cost you the game? · A: One selection doesn’t lose a game of Origin. Seventeen blokes and a coach share that.',
  ],
}

export function buildPressConference(
  result: MatchResult,
  band: PressureBand,
  story: Storyline | undefined,
  seed: number,
  coach: Coach,
): PressExchange[] {
  const fill = (s: string) => s.replaceAll('{coachFirst}', coach.first)
  const won = result.winner === 'QLD'
  const key = won ? 'win' : 'loss'
  const pool = OPENERS[key][tempOf(band)]
  const opener = pool[(seed >>> 8) % pool.length]
  const exchanges: PressExchange[] = [{ question: fill(opener.question), answer: fill(opener.answer) }]
  if (story) {
    const f = FOLLOW_UPS[key][(seed >>> 10) % FOLLOW_UPS[key].length].replaceAll('{player}', story.playerName)
    const [q, a] = f.split(' · A: ')
    exchanges.push({ question: q.replace(/^Q: /, ''), answer: a })
  }
  return exchanges
}
