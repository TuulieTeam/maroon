import { PRESSURE_BANDS, pressureBand } from '../../coach'
import './BackPage.css'

/** The hub's hot-seat gauge — how warm is the coach's chair. The band is the story, the bar is proof. */
export function HotSeat({ pressure, coachName = 'Billy Slater' }: { pressure: number; coachName?: string }) {
  const band = pressureBand(pressure)
  const meta = PRESSURE_BANDS[band]
  return (
    <section className={`hot-seat band-${band}`} aria-label="Coach pressure">
      <div className="hot-seat-head">
        <span className="hot-seat-title">🔥 The Hot Seat · {coachName}</span>
        <span className="hot-seat-band">{meta.label}</span>
      </div>
      <div className="hot-seat-track" role="img" aria-label={`Pressure ${pressure} of 100 — ${meta.label}`}>
        <div className="hot-seat-fill" style={{ width: `${pressure}%` }} />
      </div>
      <p className="hot-seat-blurb">{meta.blurb}</p>
    </section>
  )
}
