import { useEffect, useRef, useState } from 'react'
import type { MatchEvent } from '../../engine'
import './CommentaryFeed.css'

interface CommentaryFeedProps {
  events: MatchEvent[]
}

/** How close to the bottom (px) still counts as "watching live" and keeps the feed auto-scrolling. */
const STICK_THRESHOLD = 48

function lineClass(event: MatchEvent): string {
  const classes = ['commentary-line']
  if (event.type === 'COLOR') classes.push('color')
  if (event.type === 'TRY') classes.push(event.side === 'QLD' ? 'try-qld' : 'try-nsw')
  if (event.type === 'PENALTY') classes.push('penalty')
  if (event.type === 'INTERCHANGE') classes.push('interchange')
  if (event.type === 'LINE_BREAK' || event.type === 'HALF_BREAK') classes.push('break')
  if (event.type === 'HALF_TIME' || event.type === 'FULL_TIME') classes.push('major')
  return classes.join(' ')
}

/**
 * A scrollable live feed: the FULL call log is kept (newest at the bottom) and the view auto-sticks to
 * the live edge as calls arrive. Scroll up to read what flew by and the feed stops chasing the bottom;
 * a "Jump to live" pill returns you to the action. Only this region scrolls when the pointer is over
 * it, so the page still scrolls normally elsewhere.
 */
export function CommentaryFeed({ events }: CommentaryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [showJump, setShowJump] = useState(false)

  // Chase the live edge when a new call arrives — but only while the viewer is parked at the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [events.length])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
    stick.current = atBottom
    setShowJump(!atBottom)
  }

  const jumpToLive = () => {
    const el = scrollRef.current
    // Instant, not smooth: a smooth animation fires intermediate scroll events that would re-trigger
    // handleScroll mid-flight (seeing "not at bottom") and cancel the re-stick during fast playback.
    if (el) el.scrollTop = el.scrollHeight
    stick.current = true
    setShowJump(false)
  }

  return (
    <div className="commentary-feed-wrap">
      <div className="commentary-feed" ref={scrollRef} onScroll={handleScroll} aria-live="polite">
        {events.map((event) => (
          <div className={lineClass(event)} key={event.seq}>
            <span className="commentary-minute">{event.minute}&apos;</span>
            <span className="commentary-text">
              {event.persona && <span className="commentary-analyst">{event.persona}</span>}
              {event.commentary}
            </span>
          </div>
        ))}
      </div>
      {showJump && (
        <button className="commentary-jump" onClick={jumpToLive}>
          ↓ Jump to live
        </button>
      )}
    </div>
  )
}
