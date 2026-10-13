import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryImage } from './projects'

const pad = (n: number) => String(n).padStart(2, '0')

/** the left/right swipe of a touch or pen, for moving between images */
function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') start.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) onSwipe(dx < 0 ? 1 : -1)
    },
  }
}

/**
 * A project's images as a carousel: swipe or use the arrows to move along, and click
 * one to open it large in a modal, where the arrows (and arrow keys) carry on through them.
 */
export default function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const track = useRef<HTMLDivElement>(null)
  const slides = useRef<(HTMLButtonElement | null)[]>([])
  const [at, setAt] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const many = images.length > 1
  const alt = (n: number) => images[n].caption || `${title}, image ${n + 1}`

  // which slide is in view, from the track's scroll position
  useEffect(() => {
    const el = track.current
    if (!el || !many) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      const off = (s: HTMLElement | null) => (s ? Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid) : Infinity)
      let best = 0
      slides.current.forEach((s, n) => {
        if (off(s) < off(slides.current[best])) best = n
      })
      setAt(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [many])

  const goTo = useCallback((n: number) => {
    const el = track.current
    const s = slides.current[n]
    if (!el || !s) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: s.offsetLeft - (el.clientWidth - s.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
    setAt(n)
  }, [])

  const close = useCallback(() => {
    setOpen((o) => {
      if (o !== null) {
        goTo(o) // the carousel follows to the image the visitor ended on
        slides.current[o]?.focus({ preventScroll: true })
      }
      return null
    })
  }, [goTo])
  const step = useCallback(
    (d: number) => setOpen((o) => (o === null ? o : (o + d + images.length) % images.length)),
    [images.length],
  )
  const swipe = useSwipe(step)

  // while open: Escape closes only the modal (not the whole project), arrows move through the images
  const isOpen = open !== null
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && many) step(1)
      else if (e.key === 'ArrowLeft' && many) step(-1)
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isOpen, many, close, step])

  if (images.length === 0) return null
  const host = typeof document !== 'undefined' ? document.querySelector('.dk-root') : null

  return (
    <section className="gl" aria-label="Images" aria-roledescription="carousel">
      <div ref={track} className="gl__track" data-many={many ? '' : undefined}>
        {images.map((g, n) => (
          <figure key={n} className="gl__slide" aria-roledescription="slide" aria-label={`${n + 1} of ${images.length}`}>
            <button
              ref={(el) => {
                slides.current[n] = el
              }}
              type="button"
              className="gl__open"
              onClick={() => setOpen(n)}
              aria-label={`${alt(n)}: view larger`}
            >
              <img src={g.image} alt={alt(n)} loading="eager" draggable={false} />
            </button>
            {g.caption && <figcaption>{g.caption}</figcaption>}
          </figure>
        ))}
      </div>

      {many && (
        <div className="gl__bar">
          <span className="gl__count">
            {pad(at + 1)} / {pad(images.length)}
          </span>
          <span className="gl__dots" aria-hidden="true">
            {images.map((_, n) => (
              <i key={n} data-on={n === at ? '' : undefined} />
            ))}
          </span>
          <span className="gl__arrows">
            <button type="button" className="gl__arrow" aria-label="Previous image" disabled={at === 0} onClick={() => goTo(at - 1)}>
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="gl__arrow"
              aria-label="Next image"
              disabled={at === images.length - 1}
              onClick={() => goTo(at + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </span>
        </div>
      )}

      {open !== null &&
        host &&
        createPortal(
          <div className="gl-modal" role="dialog" aria-modal="true" aria-label={`${title}: images`} onClick={close}>
            <button ref={closeRef} type="button" className="gl-modal__close" onClick={close}>
              <span aria-hidden="true">×</span> Close
            </button>
            {many && (
              <button
                type="button"
                className="gl-modal__nav gl-modal__nav--prev"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
              >
                <span aria-hidden="true">←</span>
              </button>
            )}
            <figure className="gl-modal__fig" key={open} onClick={(e) => e.stopPropagation()} {...swipe}>
              <img src={images[open].image} alt={alt(open)} draggable={false} />
              <figcaption>
                {many && (
                  <span className="gl-modal__count">
                    {pad(open + 1)} / {pad(images.length)}
                  </span>
                )}
                {images[open].caption && <span>{images[open].caption}</span>}
              </figcaption>
            </figure>
            {many && (
              <button
                type="button"
                className="gl-modal__nav gl-modal__nav--next"
                aria-label="Next image"
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
