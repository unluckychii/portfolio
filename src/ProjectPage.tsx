import { useEffect, useMemo } from 'react'
import { marked } from 'marked'
import { SPECIMENS, TOTAL, projectHref, type Specimen } from './specimens'

export default function ProjectPage({ no }: { no: string }) {
  const index = SPECIMENS.findIndex((s) => s.no === no && s.more.enabled)
  const s: Specimen | undefined = SPECIMENS[index]

  useEffect(() => {
    document.title = s ? `${s.more.title} — Herbarium` : 'Sheet not found — Herbarium'
    window.scrollTo(0, 0)
  }, [s])

  // body is written by the site's editors in the CMS (repo write access), so it is trusted markdown
  const html = useMemo(() => (s ? (marked.parse(s.more.body, { async: false }) as string) : ''), [s])

  const withPages = SPECIMENS.filter((x) => x.more.enabled)
  const pos = s ? withPages.indexOf(s) : -1
  const next = pos >= 0 && withPages.length > 1 ? withPages[(pos + 1) % withPages.length] : null

  return (
    <div className="pj-root">
      <header className="pj-top">
        <a href="/" className="pj-back">
          <span aria-hidden="true">←</span> Back to the desk
        </a>
        <span className="pj-top__c">Herbarium <em>Vol. III</em></span>
        <span className="pj-top__r">Oversight Supply</span>
      </header>

      {!s ? (
        <main className="pj-missing">
          <p className="pj-kicker">Catalogue · no entry</p>
          <h1 className="pj-title">This sheet has no page.</h1>
          <p className="pj-intro">It may have been removed or renamed. The rest of the collection is on the desk.</p>
          <a href="/" className="pj-btn">Back to the desk</a>
        </main>
      ) : (
        <main className="pj-main">
          <section className="pj-hero">
            <figure className="pj-sheet">
              <div className="pj-sheet__photo">
                {s.src && <img src={s.src} alt={`Pressed specimen: ${s.common}`} />}
              </div>
              <figcaption className="pj-sheet__label">
                <span className="pj-sheet__no">No. {s.no}</span>
                <span className="pj-sheet__name">{s.latin}</span>
              </figcaption>
              <i className={`pj-tape pj-tape--${s.tape}`} aria-hidden="true" />
            </figure>

            <div className="pj-lede">
              <p className="pj-kicker">
                No. {s.no}/{TOTAL}
                {s.latin && <> · {s.latin}</>}
                {s.pressed && <> · pressed {s.pressed}</>}
              </p>
              <h1 className="pj-title">{s.more.title}</h1>
              {s.more.intro && <p className="pj-intro">{s.more.intro}</p>}

              {(s.more.facts.length > 0 || s.place) && (
                <dl className="pj-facts">
                  {s.place && (
                    <div>
                      <dt>Found</dt>
                      <dd>{s.place}</dd>
                    </div>
                  )}
                  {s.more.facts.map((f, i) => (
                    <div key={i}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {s.more.link && (
                <a className="pj-btn" href={s.more.link.url} target="_blank" rel="noopener noreferrer">
                  {s.more.link.label} <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </section>

          {html.trim() && <article className="pj-body" dangerouslySetInnerHTML={{ __html: html }} />}

          {s.more.gallery.length > 0 && (
            <section className="pj-gallery" aria-label="Gallery">
              {s.more.gallery.map((g, i) => (
                <figure key={i} className="pj-plate">
                  <img src={g.image} alt={g.caption || `${s.more.title}, image ${i + 1}`} loading="lazy" />
                  <figcaption>
                    <span className="pj-plate__no">Pl. {String(i + 1).padStart(2, '0')}</span>
                    {g.caption}
                  </figcaption>
                </figure>
              ))}
            </section>
          )}

          <footer className="pj-foot">
            <a href="/" className="pj-btn pj-btn--ghost">
              <span aria-hidden="true">←</span> All sheets
            </a>
            {next && (
              <a href={projectHref(next)} className="pj-next">
                <span className="pj-kicker">Next · No. {next.no}</span>
                <span className="pj-next__title">{next.more.title}</span>
              </a>
            )}
          </footer>
        </main>
      )}
    </div>
  )
}
