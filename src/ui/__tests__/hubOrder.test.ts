import { describe, expect, it } from 'vitest'
import { hubSpotlight } from '../hubOrder'

describe('hubSpotlight', () => {
  it('the chase leads only when the season is done AND the daily is spent', () => {
    expect(hubSpotlight('complete', true)).toBe('chase')
    expect(hubSpotlight('complete', false)).toBe('campaign')
    expect(hubSpotlight('in-progress', true)).toBe('campaign')
    expect(hubSpotlight('in-progress', false)).toBe('campaign')
  })
})
