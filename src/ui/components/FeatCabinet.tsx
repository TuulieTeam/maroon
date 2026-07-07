import { FEATS } from '../../feats'
import type { FeatCategory, FeatsLedger } from '../../feats'
import './FeatCabinet.css'

const SHELF_ORDER: FeatCategory[] = ['series', 'difficulty', 'blues', 'match', 'coach', 'daily', 'scenario', 'dynasty']

const SHELF_LABELS: Record<FeatCategory, string> = {
  series: 'Series Shape',
  difficulty: 'The Difficulty Chase',
  blues: 'The Blues Variants',
  match: 'Stat Lines',
  coach: "The Coach's Chase",
  daily: 'The Daily',
  scenario: 'This Day in Origin',
  dynasty: 'The Long Arc',
}

/**
 * The hub trophy cabinet, shelved by category. Earned feats glow gold with their flavour line (and
 * the repeat count — "×4" is a brag of its own); locked feats sit as silhouettes showing only the
 * hint, because a locked trophy with a name on it is a self-imposed challenge.
 */
export function FeatCabinet({ ledger }: { ledger: FeatsLedger }) {
  const earnedCount = FEATS.filter((f) => ledger.earned[f.id]).length
  return (
    <section className="feat-cabinet" aria-label="Feats">
      <div className="feat-cabinet-head">
        <h2>Trophy Cabinet</h2>
        <span className="feat-cabinet-tally">
          {earnedCount}/{FEATS.length}
        </span>
      </div>
      {SHELF_ORDER.map((cat) => {
        const shelf = FEATS.filter((f) => f.category === cat)
        if (shelf.length === 0) return null
        const shelfEarned = shelf.filter((f) => ledger.earned[f.id]).length
        return (
          <div key={cat} className="feat-shelf">
            <div className="feat-shelf-head">
              <h3 className="feat-shelf-label">{SHELF_LABELS[cat]}</h3>
              <span className="feat-shelf-tally">
                {shelfEarned}/{shelf.length}
              </span>
            </div>
            <div className="feat-grid">
              {shelf.map((f) => {
                const earned = ledger.earned[f.id]
                return earned ? (
                  <div key={f.id} className="feat-card earned">
                    <div className="feat-name">
                      🏅 {f.name}
                      {earned.count > 1 && <span className="feat-count"> ×{earned.count}</span>}
                    </div>
                    <div className="feat-line">{earned.detail ?? f.flavour}</div>
                    <div className="feat-date">first: {earned.first}</div>
                  </div>
                ) : (
                  <div key={f.id} className="feat-card locked">
                    <div className="feat-name">🔒 ?????</div>
                    <div className="feat-line">{f.hint}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
