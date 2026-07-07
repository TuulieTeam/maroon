import { FEATS } from '../../feats'
import type { FeatsLedger } from '../../feats'
import './TheChase.css'

/**
 * The hub's "what now" panel: the two or three locked trophies you're CLOSEST to, ranked by the
 * best-ever recorded approach. Feats you've brushed against show their name and how close you came;
 * the fill spots are the next locked hints in catalog order. Kills the post-series dead end — the
 * hub always names a next deed.
 */
export function TheChase({ ledger }: { ledger: FeatsLedger }) {
  const locked = FEATS.filter((f) => !ledger.earned[f.id])
  if (locked.length === 0) return null

  const approached = locked
    .filter((f) => ledger.approaches?.[f.id])
    .sort((a, b) => ledger.approaches![b.id].closeness - ledger.approaches![a.id].closeness)
  const fillers = locked.filter((f) => !ledger.approaches?.[f.id])
  const chase = [...approached, ...fillers].slice(0, 3)

  return (
    <section className="the-chase" aria-labelledby="the-chase-title">
      <h2 id="the-chase-title">The Chase</h2>
      <ul className="chase-list">
        {chase.map((f) => {
          const approach = ledger.approaches?.[f.id]
          return (
            <li key={f.id} className="chase-row">
              <span className="chase-name">{approach ? `🏅 ${f.name}` : '🔒 ?????'}</span>
              <span className="chase-hint">{f.hint}</span>
              {approach && (
                <span className="chase-closest">
                  Closest: {approach.line} · {approach.date}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
