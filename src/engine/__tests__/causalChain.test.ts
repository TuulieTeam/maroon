import { describe, expect, it } from 'vitest'
import type { Player } from '../../data/types'
import { simulateMatch } from '../simulate'
import { defaultSetup, makePlayer } from './fixtures'

const WEAK_CL: Player = makePlayer('weak-cl', 30, { attack: 70, speed: 70 })
const STRONG_CL: Player = makePlayer('strong-cl', 92, { attack: 70, speed: 70 })

function meanLeftEdgeConcession(cl: Player, seeds: number): { tries: number; breaks: number } {
  let tries = 0
  let breaks = 0
  for (let seed = 0; seed < seeds; seed++) {
    // NSW's right-side attack runs at QLD's LEFT edge -> recorded as RIGHT-channel NSW tries.
    const result = simulateMatch(defaultSetup({ CL: cl }), seed)
    tries += result.stats.byChannel.RIGHT.nswTries
    breaks += result.stats.lineBreaks.NSW
  }
  return { tries: tries / seeds, breaks: breaks / seeds }
}

describe('causal chain: weak left centre is targeted by NSW right edge', () => {
  const N = 200

  it('a weak left centre concedes substantially more down that edge than a strong one', () => {
    const weak = meanLeftEdgeConcession(WEAK_CL, N)
    const strong = meanLeftEdgeConcession(STRONG_CL, N)

    // Headline assertion: the weak pick leaks materially more right-edge NSW tries.
    expect(weak.tries).toBeGreaterThan(strong.tries)
    const margin = weak.tries - strong.tries
    expect(margin).toBeGreaterThan(0.4)

    // Report the observed margin for the change summary.
     
    console.log(
      `[causalChain] weak-CL RIGHT-edge NSW tries=${weak.tries.toFixed(2)} ` +
        `strong-CL=${strong.tries.toFixed(2)} margin=${margin.toFixed(2)} (N=${N})`,
    )
  })

  it('a high proportion of seeds show weak >= strong concession', () => {
    let weakWorse = 0
    const N2 = 200
    for (let seed = 0; seed < N2; seed++) {
      const w = simulateMatch(defaultSetup({ CL: WEAK_CL }), seed).stats.byChannel.RIGHT.nswTries
      const s = simulateMatch(defaultSetup({ CL: STRONG_CL }), seed).stats.byChannel.RIGHT.nswTries
      if (w >= s) weakWorse += 1
    }
    expect(weakWorse / N2).toBeGreaterThan(0.6)
  })
})

describe('bench quality affects late-match defence (interchange addendum)', () => {
  const N = 160

  // Bench forwards rotate into the MIDDLE channel (PL/PR/HK/LK), so the bench's defensive
  // quality shows up most directly as NSW middle tries conceded in the back 20 minutes.
  // Under the 2026 rules only the 4 USABLE bench (INT1–4) enter in a normal match, so only those
  // four carry the tested quality; INT5/INT6 stay neutral (they never come on without an unlock).
  function lateMiddleNswTries(benchDefence: number): number {
    const bench: Player[] = [
      { ...makePlayer('b1', benchDefence, { attack: 72 }), naturalPositions: ['PR', 'PL', 'LK'] },
      { ...makePlayer('b2', benchDefence, { attack: 72 }), naturalPositions: ['PL', 'PR', 'LK'] },
      { ...makePlayer('b3', benchDefence, { attack: 72 }), naturalPositions: ['LK', 'PL', 'PR'] },
      { ...makePlayer('b4', benchDefence, { attack: 72 }), naturalPositions: ['PL', 'PR', 'LK'] },
    ]
    let lateMiddle = 0
    for (let seed = 0; seed < N; seed++) {
      const result = simulateMatch(
        defaultSetup({ INT1: bench[0], INT2: bench[1], INT3: bench[2], INT4: bench[3] }),
        seed,
      )
      lateMiddle += result.events.filter(
        (e) => e.type === 'TRY' && e.side === 'NSW' && e.channel === 'MIDDLE' && e.minute >= 60,
      ).length
    }
    return lateMiddle / N
  }

  it('a fresh, strong bench concedes fewer late NSW middle tries than a weak bench', () => {
    const weakBench = lateMiddleNswTries(28)
    const strongBench = lateMiddleNswTries(95)
     
    console.log(
      `[bench] late(60-80) NSW MIDDLE tries weakBench=${weakBench.toFixed(3)} ` +
        `strongBench=${strongBench.toFixed(3)} (N=${N})`,
    )
    expect(strongBench).toBeLessThan(weakBench)
    expect(weakBench - strongBench).toBeGreaterThan(0.15)
  })
})
