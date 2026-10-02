import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GARMENTS, RAIL_TITLE } from './rail'
import { RailScene } from './RailScene'

/** a wire hanger, its hook at the top centre */
function Hanger() {
  return (
    <svg className="rl__hanger" viewBox="0 0 120 40" aria-hidden="true">
      <path
        d="M60 14c0-4 3-6 5-8.5S66 0 60 0s-6 4-6 4M60 14L6 36q-4 2 0 3h108q4-1 0-3L60 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Clothes on a rail: each piece hangs side-on and turns to face you on hover;
 * clicking one opens it up close, with the others a click (or arrow key) away.
 */
export default function Rail() {
  const [hover, setHover] = useState<number | null>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const closeRef = useRef<HTMLButtonElement>(null)
  const stage3d = useRef<HTMLDivElement>(null)
  const scene = useRef<RailScene | null>(null)
  /** 3D until it fails to start; then the flat rail below stays */
  const [mode, setMode] = useState<'3d' | 'flat'>('3d')

  useEffect(() => {
    const host = stage3d.current
    if (!host || GARMENTS.length === 0) return
    let s: RailScene
    try {
      s = new RailScene(host, GARMENTS.map((g) => ({ src: g.image, front: g.front })))
    } catch (err) {
      console.warn('The 3D clothes rail could not start; showing the flat one.', err)
      setMode('flat')
      return
    }
    s.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    s.onHover = setHover
    s.onPick = setZoom
    s.ready.catch((err) => {
      console.warn('The 3D clothes rail could not load; showing the flat one.', err)
      setMode('flat')
    })
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [])

  // the scene turns whichever piece is hovered, focused or open up close
  useEffect(() => {
    scene.current?.setActive(zoom ?? hover)
  }, [hover, zoom])

  const close = useCallback(() => {
    setZoom((z) => {
      if (z !== null) buttons.current[z]?.focus({ preventScroll: true })
      return null
    })
  }, [])
  const step = useCallback((d: number) => setZoom((z) => (z === null ? z : (z + d + GARMENTS.length) % GARMENTS.length)), [])

  // while a piece is up close: Escape closes it (and only it), arrows move along the rail
  const zoomed = zoom !== null
  useEffect(() => {
    if (!zoomed) return
    const root = document.querySelector<HTMLElement>('.dk-root')
    root?.setAttribute('data-zoom', '')
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
      e.stopImmediatePropagation() // the desk's own Escape would close the whole page
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      root?.removeAttribute('data-zoom')
    }
  }, [zoomed, close, step])

  if (GARMENTS.length === 0) return null
  const shown = hover ?? null
  const piece = zoom !== null ? GARMENTS[zoom] : null
  const host = typeof document !== 'undefined' ? document.querySelector('.dk-root') : null

  return (
    <section className="rl" aria-label={RAIL_TITLE || 'Clothes rail'}>
      {RAIL_TITLE && <p className="dk-kicker rl__title">{RAIL_TITLE}</p>}
      {mode === '3d' && <div ref={stage3d} className="rl__3d" aria-hidden="true" />}
      <div className="rl__stage" data-mode={mode} onMouseLeave={() => setHover(null)}>
        <span className="rl__rod" aria-hidden="true" />
        <ul className="rl__items">
          {GARMENTS.map((g, i) => (
            <li key={i} className="rl__slot" data-open={shown === i ? '' : undefined}>
              <button
                ref={(el) => {
                  buttons.current[i] = el
                }}
                type="button"
                className="rl__g"
                aria-label={`${g.name}: view up close`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((h) => (h === i ? null : h))}
                onClick={() => setZoom(i)}
              >
                <span className="rl__swing">
                  <span className="rl__piece">
                    <Hanger />
                    <img className="rl__img" src={g.image} alt="" loading="lazy" draggable={false} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="rl__caption" aria-live="polite">
        {shown !== null ? (
          <>
            <span className="rl__name">{GARMENTS[shown].name}</span>
            {GARMENTS[shown].note && <span className="rl__note">{GARMENTS[shown].note}</span>}
          </>
        ) : (
          <>
            <span className="rl__note rl__note--mouse">Hover over a piece to see it, click for a closer look</span>
            <span className="rl__note rl__note--touch">Tap a piece for a closer look</span>
          </>
        )}
      </p>

      {piece &&
        host &&
        createPortal(
          <div className="rl-zoom" role="dialog" aria-modal="true" aria-label={piece.name} onClick={close}>
            <button ref={closeRef} type="button" className="rl-zoom__close" onClick={close}>
              <span aria-hidden="true">×</span> Close
            </button>
            {GARMENTS.length > 1 && (
              <button
                type="button"
                className="rl-zoom__nav rl-zoom__nav--prev"
                aria-label="Previous piece"
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
              >
                <span aria-hidden="true">←</span>
              </button>
            )}
            <figure className="rl-zoom__fig" key={zoom} onClick={(e) => e.stopPropagation()}>
              <span className="rl-zoom__piece">
                <Hanger />
                <img src={piece.image} alt={piece.name} />
              </span>
              <figcaption>
                <span className="rl-zoom__count">
                  {String(zoom! + 1).padStart(2, '0')} / {String(GARMENTS.length).padStart(2, '0')}
                </span>
                <span className="rl-zoom__name">{piece.name}</span>
                {piece.note && <span className="rl__note">{piece.note}</span>}
              </figcaption>
            </figure>
            {GARMENTS.length > 1 && (
              <button
                type="button"
                className="rl-zoom__nav rl-zoom__nav--next"
                aria-label="Next piece"
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
              >
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>,
          host,
        )}
    </section>
  )
}
