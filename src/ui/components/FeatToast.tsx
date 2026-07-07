import type { FeatMint } from '../../feats'
import './FeatCabinet.css'

/**
 * The earn moment — gold banners at the top of a result screen. First earns get the full flash;
 * a repeat earn ticks by quietly ("Tryless — again"). Renders nothing when the run minted nothing.
 */
export function FeatToast({ mints }: { mints: FeatMint[] }) {
  if (mints.length === 0) return null
  return (
    <div className="feat-toasts" role="status">
      {mints.map((m) => (
        <div key={m.def.id} className={`feat-toast ${m.isFirst ? 'first' : 'repeat'}`}>
          <span className="feat-toast-badge">🏅</span>
          <span className="feat-toast-body">
            <strong>
              {m.isFirst ? 'FEAT' : 'AGAIN'} · {m.def.name}
            </strong>
            <em>{m.detail ?? m.def.flavour}</em>
          </span>
        </div>
      ))}
    </div>
  )
}
