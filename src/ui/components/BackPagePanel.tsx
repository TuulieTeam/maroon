import type { BackPage, PressExchange } from '../../coach'
import './BackPage.css'

/**
 * The tabloid back page — masthead, splash headline, standfirst. Pre-game it takes a position on
 * the coach's boldest call; post-game it settles the argument. Same panel, different moment.
 */
export function BackPagePanel({ page }: { page: BackPage }) {
  return (
    <section className="back-page" aria-label="The back page">
      <div className="back-page-masthead">
        <span>{page.paper}</span>
        <span className={`back-page-stance ${page.stance}`}>{page.stance === 'backs' ? 'BACKS THE CALL' : 'SAVAGES THE CALL'}</span>
      </div>
      <h2 className="back-page-headline">{page.headline}</h2>
      {page.standfirst && <p className="back-page-standfirst">{page.standfirst}</p>}
    </section>
  )
}

/** The coach fronts the pack — rendered under the post-game back page. */
export function PressConferencePanel({ exchanges, coachSurname = 'Slater' }: { exchanges: PressExchange[]; coachSurname?: string }) {
  if (exchanges.length === 0) return null
  return (
    <section className="press-conference" aria-label="Press conference">
      <div className="press-conference-label">{coachSurname} fronts the press</div>
      {exchanges.map((e, i) => (
        <div key={i} className="press-exchange">
          <p className="press-q">“{e.question}”</p>
          <p className="press-a">
            <strong>{coachSurname.toUpperCase()}:</strong> “{e.answer}”
          </p>
        </div>
      ))}
    </section>
  )
}
