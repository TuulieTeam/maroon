import { useCallback, useEffect, useRef, useState } from 'react'
import type { MatchEvent, MatchResult } from '../../engine'

export type PlaybackSpeed = 1 | 2 | 4

/** Roughly one real second per game minute at 1x, with small jitter so it isn't metronomic. */
const MS_PER_GAME_MINUTE = 1000

export interface PlaybackState {
  revealed: MatchEvent[]
  current: MatchEvent | null
  done: boolean
  paused: boolean
  speed: PlaybackSpeed
  setSpeed: (s: PlaybackSpeed) => void
  skipToEnd: () => void
  pause: () => void
  resume: () => void
}

export function useMatchPlayback(result: MatchResult): PlaybackState {
  const [count, setCount] = useState(1)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)
  const speedRef = useRef<PlaybackSpeed>(1)
  speedRef.current = speed

  const events = result.events
  const done = count >= events.length

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => {
    if (done || paused) {
      clearTimer()
      return
    }
    const prev = events[count - 1]
    const next = events[count]
    const gameMinutesGap = Math.max(0.2, (next?.minute ?? prev.minute) - prev.minute)
    const jitter = 0.75 + Math.random() * 0.5
    const baseDelay = (Math.min(2.2, gameMinutesGap) || 0.6) * MS_PER_GAME_MINUTE * jitter
    const delay = Math.max(180, baseDelay / speedRef.current)

    timer.current = window.setTimeout(() => {
      setCount((c) => Math.min(events.length, c + 1))
    }, delay)

    return clearTimer
  }, [count, done, events, speed, paused])

  useEffect(() => clearTimer, [])

  const skipToEnd = useCallback(() => {
    clearTimer()
    setPaused(false)
    setCount(events.length)
  }, [events.length])

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])

  const revealed = events.slice(0, count)
  return {
    revealed,
    current: revealed[revealed.length - 1] ?? null,
    done,
    paused,
    speed,
    setSpeed,
    skipToEnd,
    pause,
    resume,
  }
}
