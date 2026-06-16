import { NSW_EDGE_THREATS } from '../../data/nswSquad'
import './OppositionPanel.css'

export function OppositionPanel() {
  return (
    <div className="opposition-panel">
      <h3>The Blues — Scouting Report</h3>
      <p className="opposition-sub">
        NSW pick themselves. Read their edges, then choose who you trust to hold up against them.
      </p>
      {NSW_EDGE_THREATS.map((threat) => (
        <div
          className={`threat ${threat.channel === 'RIGHT' ? 'danger' : ''}`}
          key={threat.channel}
        >
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
