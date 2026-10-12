import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { PROJECTS, projectHref, type Project } from './projects'
import Gallery from './Gallery'

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

function Padlock({ label }: { label?: string }) {
  return (
    <svg className="pj-lock" viewBox="0 0 24 24" width="13" height="13" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** remembered for the rest of the visit, so a project unlocked once stays open */
const unlockKey = (slug: string) => `desk-unlocked:${slug}`
const wasUnlocked = (slug: string) => {
  try {
    return sessionStorage.getItem(unlockKey(slug)) === '1'
  } catch {
    return false
  }
}

/** asks for a locked project's password in place of its content */
function LockScreen({ project, onUnlock }: { project: Project; onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  return (
    <form
      className="cs-lock"
      data-wrong={wrong ? '' : undefined}
      key={wrong}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim() === project.password) {
          try {
            sessionStorage.setItem(unlockKey(project.slug), '1')
          } catch {
            /* private mode: it just asks again next time */
          }
          onUnlock()
        } else {
          setWrong((w) => w + 1)
          setValue('')
          requestAnimationFrame(() => input.current?.focus())
        }
      }}
    >
      <Padlock />
      <p className="cs-lock__title">This project is password protected</p>
      <p className="cs-lock__note">Enter the password to see the case study.</p>
      <span className="cs-lock__row">
        <label className="dk-sr" htmlFor={`pw-${project.slug}`}>
          Password
        </label>
        <input
          ref={input}
          id={`pw-${project.slug}`}
          type="password"
          autoComplete="off"
          placeholder="Password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={wrong ? true : undefined}
          aria-describedby={wrong ? `pw-${project.slug}-err` : undefined}
        />
        <button type="submit" className="dk-btn">
          Unlock
        </button>
      </span>
      {wrong > 0 && (
        <p id={`pw-${project.slug}-err`} className="cs-lock__err" role="alert">
          That password isn't right. Try again.
        </p>
      )}
    </form>
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
            <span className="pj-shelf__title">
              {p.title}
              {p.password && <Padlock label="Password protected" />}
            </span>
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
  /** a locked project shows only its cover and title until the password is given */
  const [unlocked, setUnlocked] = useState(() => !project.password || wasUnlocked(project.slug))
  useEffect(() => setUnlocked(!project.password || wasUnlocked(project.slug)), [project])
  const locked = !unlocked

  // a new project starts at the top, with focus on the page for keyboard and screen readers
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
    ref.current?.focus({ preventScroll: true })
  }, [project])

  // how far through the page the visitor has read, shown as a thin bar under the header
  const bar = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const room = el.scrollHeight - el.clientHeight
      bar.current?.style.setProperty('--read', String(room > 0 ? Math.min(1, el.scrollTop / room) : 0))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll) // images loading in change how far there is to go
    ro.observe(el.firstElementChild ?? el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
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
        <span ref={bar} className="cs__progress" aria-hidden="true" />
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
          {!locked && facts.length > 0 && (
            <dl className="cs__facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {locked && <LockScreen project={project} onUnlock={() => setUnlocked(true)} />}
          {!locked && project.link && (
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

      {!locked && (
        <>
          {project.intro && <p className="cs__intro">{project.intro}</p>}
          {html.trim() && <div className="cs__body dk-body" dangerouslySetInnerHTML={{ __html: html }} />}
          {project.gallery.length > 0 && <Gallery key={project.slug} images={project.gallery} title={project.title} />}
        </>
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
