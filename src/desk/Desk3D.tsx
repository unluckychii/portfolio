import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { DeskScene, type Cover, type Pickable } from './DeskScene'
import { DESK_OBJECTS, deskHref, isDeskId, type DeskId } from './objects'

const idFromPath = () => {
  const m = window.location.pathname.match(/^\/([^/]+)\/?$/)
  const id = m ? decodeURIComponent(m[1]) : undefined
  return isDeskId(id) ? id : null
}

/** how much of the screen the page covers: a column on the right, or the lower 62% on phones (see desk3d.css) */
const panelCover = (): Cover => {
  const w = window.innerWidth
  return w < 760 ? { x: 0, y: 0.62 } : { x: Math.min(560, w * 0.46) / w, y: 0 }
}

const LABELS: Record<Pickable, { name: string; hint: string }> = {
  ...Object.fromEntries(DESK_OBJECTS.map((o) => [o.id, { name: o.label, hint: o.hint }])),
  lamp: { name: 'The lamp', hint: 'Click to switch' },
} as Record<Pickable, { name: string; hint: string }>

export default function Desk3D() {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const engineRef = useRef<DeskScene | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState<DeskId | null>(idFromPath)
  const [hovered, setHovered] = useState<Pickable | null>(null)
  const [noGl, setNoGl] = useState(false)

  const current = DESK_OBJECTS.find((o) => o.id === open) ?? null

  /* -------------------------------------------------- open & close */
  const show = useCallback((id: DeskId, push: boolean) => {
    const engine = engineRef.current
    if (id === 'pigeon') engine?.pigeonHop()
    engine?.focus(id, panelCover())
    setOpen(id)
    if (push && window.location.pathname !== deskHref(id)) history.pushState(null, '', deskHref(id))
  }, [])

  const hide = useCallback((push: boolean) => {
    engineRef.current?.release()
    setOpen(null)
    if (push && window.location.pathname !== deskHref()) history.pushState(null, '', deskHref())
    returnFocus.current?.focus({ preventScroll: true })
  }, [])

  const pick = useCallback(
    (id: Pickable) => {
      if (id === 'lamp') engineRef.current?.toggleLamp()
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
    } catch {
      setNoGl(true) // no WebGL: the list of objects still works
      return
    }
    engineRef.current = engine
    engine.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    engine.onHover = setHovered
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
      if (id) show(id, false)
      else hide(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && idFromPath()) hide(true)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [show, hide])

  useEffect(() => {
    document.title = current ? `${current.title} — Oversight Supply` : 'Oversight Supply'
    if (current) panelRef.current?.focus({ preventScroll: true })
  }, [current])

  // body is written by the site's editors in the CMS (repo write access), so it is trusted markdown
  const html = useMemo(() => (current ? (marked.parse(current.body, { async: false }) as string) : ''), [current])

  const pos = current ? DESK_OBJECTS.indexOf(current) : -1
  const next = pos >= 0 ? DESK_OBJECTS[(pos + 1) % DESK_OBJECTS.length] : null
  const label = hovered ? LABELS[hovered] : null

  return (
    <div className="dk-root" data-open={open ? '' : undefined}>
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
          href="/"
          className="dk-top__l"
          onClick={(e) => {
            e.preventDefault()
            if (open) hide(true)
          }}
        >
          Oversight Supply
        </a>
        <span className="dk-top__c">
          The <em>desk</em>
        </span>
        <span className="dk-top__r">
          {noGl ? (
            'Pick an object'
          ) : (
            <>
              <span className="dk-wide">Drag to look around · click an object</span>
              <span className="dk-narrow">Drag · tap an object</span>
            </>
          )}
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
              <span aria-hidden="true">←</span> Back to the desk
            </button>
            {current.kicker && <p className="dk-kicker">{current.kicker}</p>}
            <h1 id="dk-title" className="dk-title">
              {current.title}
            </h1>
            {current.intro && <p className="dk-intro">{current.intro}</p>}
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
                <span className="dk-kicker">Next on the desk</span>
                <span className="dk-next__title">{next.label}</span>
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
