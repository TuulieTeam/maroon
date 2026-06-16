import type { PreMatchSpeech } from '../../engine'
import './GusSpeech.css'

interface GusSpeechProps {
  speech: PreMatchSpeech
}

/** The Phil "Gus" Gould pre-game address — the stirring send-off, rendered line by line for drama. */
export function GusSpeech({ speech }: GusSpeechProps) {
  return (
    <section className="gus-speech" aria-label="Pre-game address">
      <div className="gus-eyebrow">The Address · Phil “Gus” Gould</div>
      <h2 className="gus-title">{speech.title}</h2>
      <div className="gus-body">
        {speech.lines.map((line, i) => (
          <p key={i} style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
            {line}
          </p>
        ))}
      </div>
      <div className="gus-signoff">Now go.</div>
    </section>
  )
}
