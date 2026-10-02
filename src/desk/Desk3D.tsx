import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { DeskScene, type Cover, type Pickable } from './DeskScene'
import { BASE, DESK_OBJECTS, deskHref, idFromPathname, type DeskId } from './objects'
import { assetUrl, projectFromPathname, projectHref, type Project } from './projects'
import { ProjectPage, Shelf } from './Projects'
import Music, { onMusicState, toggleMusic } from './Music'
import { useHoverSound } from './hoverSound'
import Rail from './Rail'
import { SITE } from './site'

/** the object a page address opens; a project's address (/books/<project>) opens the books */
const idFromPath = (): DeskId | null => {
  const path = window.location.pathname
  return idFromPathname(path) ?? (path.startsWith(`${BASE}books/`) ? 'books' : null)
}
const projectFromPath = () => projectFromPathname(window.location.pathname)

/** update the address bar; some embedding frames refuse it, and the desk works without it */
const go = (path: string) => {
  try {
    history.pushState(null, '', path)
  } catch {
    /* keep going without a URL change */
  }
}

/** "The desk" → The <em>desk</em>, the header's serif flourish */
const italicLastWord = (text: string) => {
  const i = text.lastIndexOf(' ')
  return i < 0 ? <em>{text}</em> : (
    <>
      {text.slice(0, i + 1)}
      <em>{text.slice(i + 1)}</em>
    </>
  )
}

/** how much of the screen the page covers: a column on the right, or the lower 62% on phones (see desk3d.css) */
const panelCover = (): Cover => {
  const w = window.innerWidth
  return w < 760 ? { x: 0, y: 0.62 } : { x: Math.min(560, w * 0.46) / w, y: 0 }
}

const LABELS: Record<Pickable, { name: string; hint: string }> = {
  ...Object.fromEntries(DESK_OBJECTS.map((o) => [o.id, { name: o.label, hint: o.hint }])),
  lamp: { name: SITE.lampName, hint: SITE.lampHint },
  speakers: { name: SITE.speakersName, hint: SITE.music ? SITE.speakersHint : '' },
} as Record<Pickable, { name: string; hint: string }>

export default function Desk3D() {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const engineRef = useRef<DeskScene | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState<DeskId | null>(idFromPath)
  const [project, setProject] = useState<Project | null>(projectFromPath)
  /** the shelf book that opened the case study, to return focus to */
  const projectFrom = useRef<HTMLElement | null>(null)
  const [hovered, setHovered] = useState<Pickable | null>(null)
  const [noGl, setNoGl] = useState(false)
  useHoverSound(SITE.hoverSound ? assetUrl(SITE.hoverSound) : '', hovered)

  const current = DESK_OBJECTS.find((o) => o.id === open) ?? null

  /* -------------------------------------------------- open & close */
  const show = useCallback((id: DeskId, push: boolean) => {
    const engine = engineRef.current
    if (id === 'pigeon') engine?.pigeonHop()
    engine?.focus(id, panelCover())
    setOpen(id)
    setProject(null)
    if (push && window.location.pathname !== deskHref(id)) go(deskHref(id))
  }, [])

  const hide = useCallback((push: boolean) => {
    engineRef.current?.release()
    setOpen(null)
    setProject(null)
    if (push && window.location.pathname !== deskHref()) go(deskHref())
    returnFocus.current?.focus({ preventScroll: true })
  }, [])

  /* ------------------------------------------- the books' projects */
  const openProject = useCallback((p: Project, push = true) => {
    setProject(p)
    if (push && window.location.pathname !== projectHref(p.slug)) go(projectHref(p.slug))
  }, [])

  const closeProject = useCallback((push: boolean) => {
    setProject(null)
    if (push) go(deskHref('books'))
    projectFrom.current?.focus({ preventScroll: true })
  }, [])

  // the speakers' cones pump while the music plays
  useEffect(() => onMusicState((on) => engineRef.current?.setMusicPlaying(on)), [])

  // nothing on the desk shows while a case study covers it
  useEffect(() => {
    if (engineRef.current) engineRef.current.paused = !!project
  }, [project])

  const pick = useCallback(
    (id: Pickable) => {
      if (id === 'lamp') engineRef.current?.toggleLamp()
      else if (id === 'speakers') toggleMusic()
      else show(id, true)
    },
    [show],
  )

  /* ------------------------------------------------------- engine */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let engine: DeskScene
    try {
      engine = new DeskScene(host, labelRef.current)
    } catch (err) {
      console.error('The 3D desk could not start; showing the list of objects instead.', err)
      setNoGl(true) // no WebGL: the list of objects still works
      return
    }
    engineRef.current = engine
    engine.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    engine.onHover = setHovered
    if (SITE.laptopScreen) engine.showScreenImage(assetUrl(SITE.laptopScreen))
    engine.resize(host.clientWidth, host.clientHeight)
    const first = idFromPath()
    if (first) engine.focusNow(first, panelCover())

    const ro = new ResizeObserver(() => engine.resize(host.clientWidth, host.clientHeight))
    ro.observe(host)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // the engine calls the latest pick handler
  useEffect(() => {
    if (engineRef.current) engineRef.current.onPick = pick
  }, [pick, noGl])

  /* ------------------------------------------------ history & keys */
  useEffect(() => {
    const onPop = () => {
      const id = idFromPath()
      const p = projectFromPath()
      if (id && id !== open) show(id, false)
      else if (!id) hide(false)
      setProject(p)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (projectFromPath()) closeProject(true)
      else if (idFromPath()) hide(true)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [show, hide, closeProject, open])

  useEffect(() => {
    document.title = project
      ? `${project.title} — ${SITE.name}`
      : current
        ? `${current.title} — ${SITE.name}`
        : SITE.name
  }, [current, project])

  // a newly opened page takes focus; closing a case study hands it back to its book instead
  useEffect(() => {
    if (current && !projectFromPath()) panelRef.current?.focus({ preventScroll: true })
  }, [current])

  // body is written by the site's editors in the CMS (repo write access), so it is trusted markdown
  const html = useMemo(() => (current ? (marked.parse(current.body, { async: false }) as string) : ''), [current])

  const pos = current ? DESK_OBJECTS.indexOf(current) : -1
  const next = pos >= 0 ? DESK_OBJECTS[(pos + 1) % DESK_OBJECTS.length] : null
  const label = hovered ? LABELS[hovered] : null

  return (
    <div className="dk-root" data-open={open ? '' : undefined} data-project={project ? '' : undefined}>
      <div ref={hostRef} className="dk-canvas" aria-hidden="true" />

      <div ref={labelRef} className="dk-label" aria-hidden="true">
        {label && (
          <>
            <span className="dk-label__name">{label.name}</span>
            {label.hint && <span className="dk-label__hint">{label.hint}</span>}
          </>
        )}
      </div>

      <header className="dk-top">
        <a
          href={deskHref()}
          className="dk-top__l"
          onClick={(e) => {
            e.preventDefault()
            if (open) hide(true)
          }}
        >
          {/* the site name stays in the browser tab; the header shows the heading */}
          {SITE.heading ? italicLastWord(SITE.heading) : SITE.name}
        </a>
        <span className="dk-top__r">
          {noGl ? (
            SITE.hintNo3d
          ) : (
            <>
              <span className="dk-wide">{SITE.hint}</span>
              <span className="dk-narrow">{SITE.hintTouch}</span>
            </>
          )}
          {SITE.music && <Music src={assetUrl(SITE.music)} />}
        </span>
      </header>

      <nav className="dk-list" aria-label="Objects on the desk">
        {DESK_OBJECTS.map((o) => (
          <a
            key={o.id}
            href={deskHref(o.id)}
            className="dk-list__item"
            aria-current={open === o.id ? 'page' : undefined}
            data-hot={hovered === o.id ? '' : undefined}
            onMouseEnter={() => engineRef.current?.highlight(o.id)}
            onMouseLeave={() => engineRef.current?.highlight(null)}
            onFocus={() => engineRef.current?.highlight(o.id)}
            onBlur={() => engineRef.current?.highlight(null)}
            onClick={(e) => {
              e.preventDefault()
              returnFocus.current = e.currentTarget
              engineRef.current?.highlight(null)
              show(o.id, true)
            }}
          >
            <span className="dk-list__hint">{o.hint}</span>
            <span className="dk-list__name">{o.label}</span>
          </a>
        ))}
      </nav>

      {/* required by the CC BY 4.0 licences of the laptop, cup, lamp and plant models */}
      <details className="dk-credit">
        <summary>{SITE.credits}</summary>
        <p>
          <span>
            Laptop:{' '}
            <a href="https://sketchfab.com/3d-models/macbook-air-m2-786fa23d402a4f90ae36c4168997f9cc" target="_blank" rel="noopener noreferrer">
              MacBook Air M2
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/rtql8d" target="_blank" rel="noopener noreferrer">
              rtql8d
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>
            , modified
          </span>
          <span>
            Cup:{' '}
            <a href="https://sketchfab.com/3d-models/coffee-cup-8acd10b3f80344d79202d8c2dbfa6e61" target="_blank" rel="noopener noreferrer">
              Coffee Cup
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/GreenLineStudio" target="_blank" rel="noopener noreferrer">
              Lasse Harm
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>
          </span>
          <span>
            Lamp:{' '}
            <a href="https://sketchfab.com/3d-models/salt-rock-lamp-game-ready-2k-pbr-2d7ce5f36be04a2089e74c224e694ad5" target="_blank" rel="noopener noreferrer">
              Salt Rock Lamp
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/meerschaumdigital" target="_blank" rel="noopener noreferrer">
              Meerschaum Digital
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>
            , modified
          </span>
          <span>
            Speakers:{' '}
            <a href="https://sketchfab.com/3d-models/krk-rokit-rp8-g4-ab5a5d56d25e416dad13e6f859f308a5" target="_blank" rel="noopener noreferrer">
              KRK ROKIT RP8 G4
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/jeff.kershaw" target="_blank" rel="noopener noreferrer">
              jeff.kershaw
            </a>
            ,{' '}
            <a href="https://sketchfab.com/licenses" target="_blank" rel="noopener noreferrer">
              Sketchfab Standard
            </a>
          </span>
          <span>
            Plant:{' '}
            <a href="https://sketchfab.com/3d-models/assignment-8-plant-4e4e9400cb95484e874daf37fa1a3f18" target="_blank" rel="noopener noreferrer">
              Assignment 8: Plant
            </a>{' '}
            by{' '}
            <a href="https://sketchfab.com/mcginn3" target="_blank" rel="noopener noreferrer">
              Teague McGinn
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>
            , modified
          </span>
        </p>
      </details>

      <aside
        ref={panelRef}
        className="dk-panel"
        aria-hidden={!current}
        aria-labelledby={current ? 'dk-title' : undefined}
        tabIndex={-1}
        inert={!current}
      >
        {current && (
          <div className="dk-panel__inner" key={current.id}>
            <button type="button" className="dk-close" onClick={() => hide(true)}>
              <span aria-hidden="true">←</span> {SITE.back}
            </button>
            {current.kicker && <p className="dk-kicker">{current.kicker}</p>}
            <h1 id="dk-title" className="dk-title">
              {current.title}
            </h1>
            {current.intro && <p className="dk-intro">{current.intro}</p>}
            {current.id === 'laptop' && <Rail />}
            {current.id === 'books' && (
              <Shelf
                onOpen={(p, from) => {
                  projectFrom.current = from
                  openProject(p)
                }}
              />
            )}
            {html.trim() && <div className="dk-body" dangerouslySetInnerHTML={{ __html: html }} />}
            {current.links.length > 0 && (
              <div className="dk-links">
                {current.links.map((l, i) => {
                  const external = /^https?:\/\//.test(l.url)
                  return (
                    <a
                      key={i}
                      className="dk-btn"
                      href={l.url}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {l.label} {external && <span aria-hidden="true">↗</span>}
                    </a>
                  )
                })}
              </div>
            )}
            {next && next !== current && (
              <a
                href={deskHref(next.id)}
                className="dk-next"
                onClick={(e) => {
                  e.preventDefault()
                  show(next.id, true)
                }}
              >
                <span className="dk-kicker">{SITE.next}</span>
                <span className="dk-next__title">{next.label}</span>
              </a>
            )}
          </div>
        )}
      </aside>

      {project && (
        <ProjectPage
          project={project}
          backLabel={current?.title ? `Back to ${current.title.toLowerCase()}` : SITE.back}
          onClose={() => closeProject(true)}
          onOpen={(p) => openProject(p)}
        />
      )}
    </div>
  )
}
