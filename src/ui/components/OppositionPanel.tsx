import type { EdgeThreat } from '../../data/types'
import './OppositionPanel.css'

interface OppositionPanelProps {
  /** The drawn Blues side's billing, e.g. "The Big Blue Wall". */
  opponentName: string
  /** One-line scouting summary of who you're up against this series. */
  blurb: string
  /** This opponent's threat profile — the primary (first) one is flagged as the danger. */
  threats: EdgeThreat[]
}

export function OppositionPanel({ opponentName, blurb, threats }: OppositionPanelProps) {
  return (
    <div className="opposition-panel">
      <h3>{opponentName} — Scouting Report</h3>
      <p className="opposition-sub">{blurb}</p>
      {threats.map((threat, i) => (
        <div className={`threat ${i === 0 ? 'danger' : ''}`} key={threat.channel}>
          <div className="threat-headline">{threat.headline}</div>
          <div className="threat-detail">{threat.detail}</div>
          <div className="threat-men">
            {threat.dangerMen.map((name) => (
              <span className="threat-man" key={name}>
                {name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
