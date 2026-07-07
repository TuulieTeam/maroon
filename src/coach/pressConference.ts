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
    ],
  },
  loss: {
    calm: [
      {
        question: 'Where did that get away, {coachFirst}?',
        answer: 'A couple of moments, and Origin is moments. We’ll own it, review it, and be better for it.',
      },
    ],
    tense: [
      {
        question: 'The scrutiny is building — fair?',
        answer: 'Scrutiny comes with this jersey. I picked the team, I own the result. The players don’t wear that, I do.',
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
    ],
  },
}

/** The storyline follow-up — the press always circles back to the bold call. {player} woven in. */
const FOLLOW_UPS: Record<'win' | 'loss', string[]> = {
  win: [
    'Q: The {player} call — vindicated? · A: I don’t pick teams to win arguments. {player} did his job, that’s the end of it.',
    'Q: Did {player} repay you tonight? · A: He repaid his teammates. I just wrote the name down.',
  ],
  loss: [
    'Q: Do you regret the {player} call? · A: I’d make it again tomorrow. The result doesn’t change what I saw at training.',
    'Q: Was {player} the mistake tonight? · A: If you want a name for the loss, use mine. Not his.',
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
