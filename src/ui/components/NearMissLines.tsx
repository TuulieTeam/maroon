import type { NearMiss } from '../../feats'
import './NearMissLines.css'

/**
 * The "so close" block under the feat toasts — every quantifiable almost-there from the run that
 * just finished. Each line names the locked trophy it brushed against; that reveal is the chase.
 */
export function NearMissLines({ misses }: { misses: NearMiss[] }) {
  if (misses.length === 0) return null
  return (
    <div className="near-miss-block" role="status">
      <div className="near-miss-label">SO CLOSE</div>
      {misses.map((m) => (
        <div key={m.featId} className="near-miss-line">
          {m.line}
        </div>
      ))}
    </div>
  )
}
