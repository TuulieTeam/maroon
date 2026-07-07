import type { ReactNode } from 'react'
import './Wordmark.css'

interface WordmarkProps {
  /** Hero renders the big gold title (the front-door look). Omit for the compact per-screen bar. */
  hero?: boolean
  /** Optional trailing context — the game label, venue, etc. Shown after a · on the same line. */
  sub?: ReactNode
}

/**
 * The MAROON wordmark — one component owning the brand across every phase. `hero` is the
 * front-door title (Selection / Daily-select); the compact variant is a single quiet gold line
 * that persists on every other screen so the five phases read as one app.
 */
export function Wordmark({ hero = false, sub }: WordmarkProps) {
  if (hero) {
    return (
      <>
        <div className="app-title">MAROON</div>
        {sub != null && <div className="app-sub">{sub}</div>}
      </>
    )
  }
  return (
    <div className="wordmark">
      <span className="wordmark-name">MAROON</span>
      {sub != null && <span className="wordmark-sub">{sub}</span>}
    </div>
  )
}
