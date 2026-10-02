import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import { PROJECTS, projectHref, type Project } from './projects'

/** a book in CSS 3D: the cover, with its spine turned towards the viewer */
export function Book({ project, size }: { project: Project; size: 'shelf' | 'hero' }) {
  return (
    <span className={`pb pb--${size}`} aria-hidden="true">
      <span className="pb__book">
        {project.spine ? (
          <img className="pb__spine" src={project.spine} alt="" loading="lazy" />
        ) : (
          <span className="pb__spine pb__spine--plain" />
        )}
        {project.cover ? (
          <img className="pb__cover" src={project.cover} alt="" loading={size === 'hero' ? 'eager' : 'lazy'} />
        ) : (
          <span className="pb__cover pb__cover--plain">{project.title}</span>
        )}
      </span>
    </span>
  )
}

/** the books laid out in the Projects overlay; each opens its case study */
export function Shelf({ onOpen }: { onOpen: (p: Project, from: HTMLElement) => void }) {
  return (
    <ul className="pj-shelf" aria-label="Projects">
      {PROJECTS.map((p) => (
        <li key={p.slug}>
          <a
            href={projectHref(p.slug)}
            className="pj-shelf__item"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return // let new-tab clicks through
              e.preventDefault()
              onOpen(p, e.currentTarget)
            }}
          >
            <Book project={p} size="shelf" />
            <span className="pj-shelf__title">{p.title}</span>
            {p.subtitle && <span className="pj-shelf__sub">{p.subtitle}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** a project's full case study, over the whole screen */
export function ProjectPage({
  project,
  backLabel,
  onClose,
  onOpen,
}: {
  project: Project
  backLabel: string
  onClose: () => void
  onOpen: (p: Project) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // a new project starts at the top, with focus on the page for keyboard and screen readers
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
    ref.current?.focus({ preventScroll: true })
  }, [project])

  // written by the site's editors in the CMS (repo write access), so it is trusted markdown
  const html = useMemo(() => marked.parse(project.body, { async: false }) as string, [project])

  const i = PROJECTS.indexOf(project)
  const next = PROJECTS.length > 1 ? PROJECTS[(i + 1) % PROJECTS.length] : null
  const facts = [
    ['Year', project.year],
    ['Client', project.client],
    ['Role', project.role],
  ].filter(([, v]) => v)
  const external = project.link && /^https?:\/\//.test(project.link.url)

  return (
    <div ref={ref} className="cs" role="dialog" aria-modal="true" aria-labelledby="cs-title" tabIndex={-1}>
      <div className="cs__bar">
        <button type="button" className="cs__back" onClick={onClose}>
          <span aria-hidden="true">←</span> {backLabel}
        </button>
      </div>

      <header className="cs__hero">
        <div className="cs__book">
          <Book project={project} size="hero" />
        </div>
        <div className="cs__lede">
          <p className="dk-kicker">Case study{project.year && <> · {project.year}</>}</p>
          <h1 id="cs-title" className="cs__title">
            {project.title}
          </h1>
          {project.subtitle && <p className="cs__sub">{project.subtitle}</p>}
          {facts.length > 0 && (
            <dl className="cs__facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {project.link && (
            <a
              className="dk-btn"
              href={project.link.url}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {project.link.label} {external && <span aria-hidden="true">↗</span>}
            </a>
          )}
        </div>
      </header>

      {project.intro && <p className="cs__intro">{project.intro}</p>}
      {html.trim() && <div className="cs__body dk-body" dangerouslySetInnerHTML={{ __html: html }} />}

      {project.gallery.length > 0 && (
        <section className="cs__gallery" aria-label="Images">
          {project.gallery.map((g, n) => (
            <figure key={n} className="cs__plate">
              <img src={g.image} alt={g.caption || `${project.title}, image ${n + 1}`} loading="lazy" />
              {g.caption && <figcaption>{g.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}

      {next && next !== project && (
        <a
          className="cs__next"
          href={projectHref(next.slug)}
          onClick={(e) => {
            e.preventDefault()
            onOpen(next)
          }}
        >
          <Book project={next} size="shelf" />
          <span>
            <span className="dk-kicker">Next project</span>
            <span className="cs__next-title">{next.title}</span>
          </span>
        </a>
      )}
    </div>
  )
}
