/**
 * The hub's "what now" switch. Once the series is complete AND today's daily is spent, the campaign
 * panels have nothing left to offer — the chase surfaces (The Chase + the scenario library) float
 * up so the hub always leads with a next deed instead of a waiting room.
 */
export function hubSpotlight(
  seriesStatus: 'in-progress' | 'complete',
  dailyPlayed: boolean,
): 'chase' | 'campaign' {
  return seriesStatus === 'complete' && dailyPlayed ? 'chase' : 'campaign'
}
