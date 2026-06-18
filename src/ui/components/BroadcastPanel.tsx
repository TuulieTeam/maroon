import type { Segment, SegmentSlot } from '../../engine'
import './BroadcastPanel.css'

interface BroadcastPanelProps {
  slot: SegmentSlot
  segments: Segment[]
}

// "From the Desk" for the pre-game slot so it doesn't echo the screen's own "THE BUILD-UP" title.
const SLOT_TITLE: Record<SegmentSlot, string> = {
  preGame: 'From the Desk',
  halfTime: 'Half-Time',
  postGame: 'Full-Time Wrap',
}

function roleClass(role: string): string {
  return `role-${role.toLowerCase()}`
}

export function BroadcastPanel({ slot, segments }: BroadcastPanelProps) {
  // No takes for this slot → collapse entirely rather than render a hollow header-only shell.
  if (segments.length === 0) return null
  const titleId = `broadcast-title-${slot}`
  return (
    <section className="broadcast-panel" aria-labelledby={titleId}>
      <h2 className="broadcast-title" id={titleId}>
        {SLOT_TITLE[slot]}
      </h2>
      <ul className="broadcast-rows" role="list">
        {segments.map((s, i) => (
          <li className="broadcast-row" key={`${slot}-${i}`}>
            <div className="broadcast-speaker">
              <span className="broadcast-name">{s.persona}</span>
              <span className={`broadcast-role ${roleClass(s.role)}`}>{s.role}</span>
            </div>
            <div className="broadcast-line">{s.line}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
