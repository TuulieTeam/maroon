import type { Segment, SegmentSlot } from '../../engine'
import './BroadcastPanel.css'

interface BroadcastPanelProps {
  slot: SegmentSlot
  segments: Segment[]
}

const SLOT_TITLE: Record<SegmentSlot, string> = {
  preGame: 'The Build-Up',
  halfTime: 'Half-Time',
  postGame: 'Full-Time Wrap',
}

function roleClass(role: string): string {
  return `role-${role.toLowerCase()}`
}

export function BroadcastPanel({ slot, segments }: BroadcastPanelProps) {
  return (
    <div className="broadcast-panel">
      <div className="broadcast-title">{SLOT_TITLE[slot]}</div>
      <div className="broadcast-rows">
        {segments.map((s, i) => (
          <div className="broadcast-row" key={`${slot}-${i}`}>
            <div className="broadcast-speaker">
              <span className="broadcast-name">{s.persona}</span>
              <span className={`broadcast-role ${roleClass(s.role)}`}>{s.role}</span>
            </div>
            <div className="broadcast-line">{s.line}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
