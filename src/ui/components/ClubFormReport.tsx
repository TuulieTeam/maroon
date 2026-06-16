import { QLD_SQUAD } from '../../data/qldSquad'
import { formBand } from '../../series'
import type { SeriesState } from '../../series'
import './ClubFormReport.css'

const INJURY_LABEL: Record<string, string> = { out: 'out', doubtful: 'doubtful', suspended: 'susp' }

/**
 * The "team news" the player reads on the series hub before re-picking: who's red-hot, who's slumping,
 * and who's hurt. Queensland only — NSW form is hidden. Falls out of the way (returns null) if there's
 * nothing notable to report.
 */
export function ClubFormReport({ state }: { state: SeriesState }) {
  const conds = state.playerConditions
  const qld = QLD_SQUAD.map((p) => ({ p, c: conds[p.id] })).filter((x) => x.c)
  const hot = qld.filter((x) => x.c.injury.kind === 'fit' && x.c.form >= 64).sort((a, b) => b.c.form - a.c.form).slice(0, 5)
  const cold = qld.filter((x) => x.c.injury.kind === 'fit' && x.c.form <= 40).sort((a, b) => a.c.form - b.c.form).slice(0, 5)
  const news = qld.filter((x) => x.c.injury.kind !== 'fit')
  if (hot.length === 0 && cold.length === 0 && news.length === 0) return null

  return (
    <div className="club-report">
      <div className="club-report-title">Form Guide · Queensland</div>
      <div className="club-report-cols">
        {hot.length > 0 && (
          <div className="club-col">
            <div className="club-col-label hot">Red-hot</div>
            {hot.map((x) => (
              <div key={x.p.id} className="club-row">
                <span className="club-name">{x.p.name}</span>
                <span className={`club-band form-${formBand(x.c.form)}`}>{formBand(x.c.form)}</span>
              </div>
            ))}
          </div>
        )}
        {cold.length > 0 && (
          <div className="club-col">
            <div className="club-col-label cold">Slumping</div>
            {cold.map((x) => (
              <div key={x.p.id} className="club-row">
                <span className="club-name">{x.p.name}</span>
                <span className={`club-band form-${formBand(x.c.form)}`}>{formBand(x.c.form)}</span>
              </div>
            ))}
          </div>
        )}
        {news.length > 0 && (
          <div className="club-col">
            <div className="club-col-label news">Team news</div>
            {news.map((x) => (
              <div key={x.p.id} className="club-row">
                <span className="club-name">{x.p.name}</span>
                <span className={`club-injury injury-${x.c.injury.kind}`}>{INJURY_LABEL[x.c.injury.kind]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
