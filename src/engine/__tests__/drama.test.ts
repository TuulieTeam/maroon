import { afterEach, describe, expect, it } from 'vitest'
import { TUNING } from '../ratings'
import { simulateMatch } from '../simulate'
import { defaultSetup } from './fixtures'
import type { MatchEvent } from '../types'

// The drama resolvers read TUNING.drama at runtime. These tests temporarily crank those knobs
// to force otherwise-rare events, then restore them so the rest of the suite sees stock tuning.
const ORIGINAL = JSON.parse(JSON.stringify(TUNING.drama)) as Record<string, number>
const drama = TUNING.drama as unknown as Record<string, number>

function setDrama(overrides: Record<string, number>): void {
  Object.assign(drama, overrides)
}

afterEach(() => {
  Object.assign(drama, ORIGINAL)
})

function firstSeedWith(predicate: (events: MatchEvent[]) => boolean, max = 200): MatchEvent[] | null {
  for (let seed = 0; seed < max; seed++) {
    const r = simulateMatch(defaultSetup(), seed)
    if (predicate(r.events)) return r.events
  }
  return null
}

describe('drama: HIA / foul-play unlock the 5th & 6th BENCH (never the 20th/21st man)', () => {
  it('3 failed HIAs for a side unlock its extra bench and a 5th/6th body enters (RESERVE_ACTIVATED)', () => {
    // Lots of head knocks; every HIA fails. The repeated forced subs eat the 4-usable bench, then the
    // 3rd failed HIA unlocks the 5th/6th and the locked bench is activated.
    setDrama({ headKnockBase: 0.06, headKnockCollisionMult: 3, hiaFailChance: 1, foulPlayBase: 0 })

    const events = firstSeedWith((evs) => evs.some((e) => e.type === 'RESERVE_ACTIVATED'))
    expect(events).not.toBeNull()
    const activation = events!.find((e) => e.type === 'RESERVE_ACTIVATED')!
    const failsBefore = events!.filter(
      (e) => e.type === 'HIA_FAIL' && e.side === activation.side && e.seq < activation.seq,
    ).length
    expect(failsBefore).toBeGreaterThanOrEqual(3)

     
    console.log(`[drama] HIA unlock: ${failsBefore} failed HIAs before RESERVE_ACTIVATED (side ${activation.side})`)
  })

  it('a foul-play match-ending injury (with sin-bin/send-off) also unlocks the extra bench', () => {
    // Foul play on most tackles, always carded, always injuring the victim — forces a foul-injury
    // INJURY_REPLACEMENT which unlocks the victim side's 5th/6th bench.
    setDrama({
      headKnockBase: 0,
      foulPlayBase: 0.5,
      sinBinGivenFoul: 0.6,
      sendOffGivenFoul: 0.3,
      foulInjuryChance: 1,
    })

    const events = firstSeedWith(
      (evs) =>
        evs.some((e) => e.type === 'INJURY_REPLACEMENT' && e.reason === 'foul-injury') &&
        evs.some((e) => e.type === 'RESERVE_ACTIVATED'),
    )
    expect(events).not.toBeNull()
    const activation = events!.find((e) => e.type === 'RESERVE_ACTIVATED')!
    const foulInjuryBefore = events!.some(
      (e) =>
        e.type === 'INJURY_REPLACEMENT' &&
        e.reason === 'foul-injury' &&
        e.side === activation.side &&
        e.seq < activation.seq,
    )
    expect(foulInjuryBefore).toBe(true)
  })

  it('a SENT-OFF player never carries, tackles, defends, or is named again for the rest of the match', () => {
    // Modest foul rate, every foul a send-off (no injury) — then take the FIRST match that has
    // exactly ONE send-off in the whole game, so the affected channel can never be fully vacated
    // (a contrived "whole team sent off" state is not real rugby league and isn't what we're testing).
    setDrama({
      headKnockBase: 0,
      foulPlayBase: 0.01,
      sinBinGivenFoul: 0,
      sendOffGivenFoul: 1,
      foulInjuryChance: 0,
    })

    const events = firstSeedWith(
      (evs) => evs.filter((e) => e.type === 'SEND_OFF').length === 1,
      400,
    )
    expect(events).not.toBeNull()
    const sendOff = events!.find((e) => e.type === 'SEND_OFF')!
    const ruledOut = sendOff.defender!
    expect(ruledOut).toBeDefined()

    // After the send-off, the player must never appear as attacker (carrier), defender, or playerOn/off.
    let laterMentions = 0
    for (const e of events!) {
      if (e.seq <= sendOff.seq) continue
      for (const slot of [e.attacker, e.defender, e.playerOn] as Array<{ id: string } | undefined>) {
        if (slot && slot.id === ruledOut.id) laterMentions += 1
      }
    }
    expect(laterMentions).toBe(0)

     
    console.log(`[drama] send-off: ${ruledOut.name} (${ruledOut.id}, side ${sendOff.side}) excluded from all ${events!.length - sendOff.seq} later events`)
  })

  it('a SIN-BINNED player is excluded from selection during the bin, then returns', () => {
    // Modest foul rate, every foul a sin bin (no send-off, no injury). Take the first match with
    // exactly ONE sin bin, so the binned player's channel can't be fully vacated. They must not
    // feature between the bin and their 10-minute return; after that they may feature again.
    setDrama({
      headKnockBase: 0,
      foulPlayBase: 0.01,
      sinBinGivenFoul: 1,
      sendOffGivenFoul: 0,
      foulInjuryChance: 0,
      sinBinMinutes: 10,
    })

    const events = firstSeedWith(
      // Exactly one sin bin, early enough that the 10-minute return lands inside the 80 minutes.
      (evs) => {
        const bins = evs.filter((e) => e.type === 'SIN_BIN')
        return bins.length === 1 && bins[0].minute < 65
      },
      400,
    )
    expect(events).not.toBeNull()
    const binEv = events!.find((e) => e.type === 'SIN_BIN')!
    const binned = binEv.defender!
    const returnAt = binEv.minute + 10

    let duringBin = 0
    for (const e of events!) {
      if (e.seq <= binEv.seq) continue
      if (e.minute >= returnAt) break // back on the field — selection allowed again
      for (const slot of [e.attacker, e.defender, e.playerOn] as Array<{ id: string } | undefined>) {
        if (slot && slot.id === binned.id) duringBin += 1
      }
    }
    expect(duringBin).toBe(0)

    // The engine must emit a return event ~10 minutes later so the UI can un-strike the name.
    const returnEv = events!.find((e) => e.type === 'SIN_BIN_RETURN' && e.defender?.id === binned.id)
    expect(returnEv, 'sin-binned player should return after the bin period').toBeDefined()
    expect(returnEv!.minute).toBeGreaterThan(binEv.minute)
  })

  it('a sin-bin window measurably increases tries conceded versus a no-foul baseline', () => {
    const N = 120

    // Baseline: no drama at all.
    setDrama({ headKnockBase: 0, foulPlayBase: 0 })
    let baselineConceded = 0
    for (let seed = 0; seed < N; seed++) {
      baselineConceded += simulateMatch(defaultSetup(), seed).stats.tries.NSW
    }

    // Heavy QLD sin-binning: QLD spends lots of time short-handed, so NSW should score more.
    setDrama({
      headKnockBase: 0,
      foulPlayBase: 0.25,
      sinBinGivenFoul: 1,
      sendOffGivenFoul: 0,
      foulInjuryChance: 0,
      sinBinMinutes: 10,
      shortHandedDefencePenalty: 22,
    })
    let binnedConceded = 0
    for (let seed = 0; seed < N; seed++) {
      binnedConceded += simulateMatch(defaultSetup(), seed).stats.tries.NSW
    }

    const base = baselineConceded / N
    const binned = binnedConceded / N
     
    console.log(`[drama] NSW tries vs QLD: baseline=${base.toFixed(2)} heavy-QLD-sinbin=${binned.toFixed(2)} (N=${N})`)
    expect(binned).toBeGreaterThan(base)
  })
})
