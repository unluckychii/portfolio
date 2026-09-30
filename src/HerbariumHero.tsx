import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { DeskEngine, type Mode } from './DeskEngine'
import { FEATURE, SPECIMENS } from './specimens'

gsap.registerPlugin(ScrollTrigger)

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// scroll story: 0 → pile, SORT → index grid, 1 → inside sheet 07
const story = (p: number) => ({ sort: smooth(0.07, 0.46, p), zoom: smooth(0.6, 0.9, p) })
const SORTED_AT = 0.5

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function HerbariumHero() {
  const trackRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<DeskEngine | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const stRef = useRef<ScrollTrigger | null>(null)
  const progressRef = useRef(0)
  const reduced = usePrefersReducedMotion()

  const [loaded, setLoaded] = useState(0)
  const [broken, setBroken] = useState<Set<number>>(() => new Set())
  const [flipped, setFlipped] = useState<Set<number>>(() => new Set())
  const [read, setRead] = useState<Set<number>>(() => new Set())
  const [isTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  const ready = loaded >= SPECIMENS.length

  /* ------------------------------------------------ preload every sheet */
  useEffect(() => {
    let alive = true
    SPECIMENS.forEach((s, i) => {
      const img = new Image()
      img.onload = () => alive && setLoaded((n) => n + 1)
      img.onerror = () => {
        if (!alive) return
        setBroken((b) => new Set(b).add(i)) // the sheet still shows, just without its photo
        setLoaded((n) => n + 1)
      }
      img.src = s.src
    })
    return () => {
      alive = false
    }
  }, [])

  /* ------------------------------------------------------------- engine */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !ready) return
    const els = Array.from(stage.querySelectorAll<HTMLElement>('[data-card]'))
    const engine = new DeskEngine(stage, els, coverRef.current, FEATURE)
    engineRef.current = engine
    engine.reduced = reduced
    engine.onMode = (m: Mode) => {
      stage.dataset.mode = m
    }
    engine.resize(stage.clientWidth, stage.clientHeight)
    const s = story(progressRef.current)
    engine.setStory(s.sort, s.zoom)
    engine.deal()
    engine.render()

    let running = false
    let inView = true
    const tick = (_t: number, dtMs: number) => engine.step(dtMs / 1000)
    const sync = () => {
      const want = inView && !document.hidden
      if (want && !running) gsap.ticker.add(tick)
      if (!want && running) gsap.ticker.remove(tick)
      running = want
    }
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting
      sync()
    })
    if (trackRef.current) io.observe(trackRef.current)
    document.addEventListener('visibilitychange', sync)
    sync()
    const ro = new ResizeObserver(() => engine.resize(stage.clientWidth, stage.clientHeight))
    ro.observe(stage)

    return () => {
      gsap.ticker.remove(tick)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', sync)
      engineRef.current = null
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (engineRef.current) engineRef.current.reduced = reduced
  }, [reduced, ready])

  /* ------------------------------------------------ pointer: throw & tap */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !ready) return
    const local = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      if (e.button > 0) return
      const p = local(e)
      if (engineRef.current?.grab(e.target as Element, e.pointerId, p.x, p.y)) {
        stage.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }
    const move = (e: PointerEvent) => {
      const p = local(e)
      engineRef.current?.move(e.pointerId, p.x, p.y)
    }
    const up = (e: PointerEvent) => {
      const eng = engineRef.current
      if (!eng) return
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const tap = eng.release(e.pointerId)
      const card = eng.cardAt(target)
      if (tap && card) flip(eng.cards.indexOf(card))
    }
    const cancel = () => engineRef.current?.cancel()
    stage.addEventListener('pointerdown', down)
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerup', up)
    stage.addEventListener('pointercancel', cancel)
    return () => {
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerup', up)
      stage.removeEventListener('pointercancel', cancel)
    }
  }, [ready])

  const flip = (i: number) => {
    setFlipped((f) => {
      const n = new Set(f)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
    setRead((r) => (r.has(i) ? r : new Set(r).add(i)))
  }

  /* -------------------------------------------------------- smooth scroll */
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ lerp: 0.085 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  /* ------------------------------------------------ intro + scroll story */
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.2 })
          .from('.hb-top > *', { opacity: 0, y: -8, duration: 1, stagger: 0.08 })
          .from('.hb-head .li', { yPercent: 110, duration: 1.6, stagger: 0.09 }, 0.15)
          .from('.hb-aside__in, .hb-dock__in', { opacity: 0, y: 10, duration: 1.2, stagger: 0.1 }, 0.8)
      }

      const target = { p: 0 } // fresh per run: a StrictMode revert can't zero a shared object
      const apply = (p: number) => {
        progressRef.current = p
        const s = story(p)
        const eng = engineRef.current
        if (eng) {
          eng.setStory(s.sort, s.zoom)
          if (reduced) eng.render()
        }
      }
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      tl.to(target, { p: 1, duration: 1, onUpdate: () => apply(target.p) }, 0)
        .to('.hb-head, .hb-aside, .hb-dock', { opacity: 0, y: -20, duration: 0.07, stagger: 0.015 }, 0.04)
        .fromTo('.hb-index', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.06 }, 0.36)
        .to('.hb-index', { opacity: 0, y: -16, duration: 0.05 }, 0.58)
        .fromTo('.hb-final', { opacity: 0, y: 30, pointerEvents: 'none' }, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.07 }, 0.91)

      stRef.current = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        animation: reduced ? undefined : tl,
        scrub: reduced ? false : 0.6,
        onUpdate(self) {
          if (!reduced) return
          // discrete states only: pile → index → sheet
          const p = self.progress > 0.75 ? 1 : self.progress > 0.25 ? SORTED_AT : 0
          tl.progress(p)
          apply(p)
        },
      })
      apply(0)
    }, stageRef)
    return () => {
      stRef.current = null
      ctx.revert()
    }
  }, [reduced])

  const scrollToProgress = (p: number, then?: () => void) => {
    const st = stRef.current
    if (!st) return
    const y = st.start + (st.end - st.start) * p
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: p === 0 ? 2.2 : 1.6, onComplete: then })
    else {
      window.scrollTo({ top: y, behavior: 'auto' })
      then?.()
    }
  }
  const scatterAgain = () => {
    setFlipped(new Set())
    scrollToProgress(0, () => engineRef.current?.shuffle())
  }

  const count = String(read.size).padStart(2, '0')

  return (
    <main className="hb-root" data-ready={ready}>
      <section ref={trackRef} className="hb-track" aria-label="Herbarium — a pile of pressed specimens">
        <div ref={stageRef} className="hb-stage" data-mode="pile">
          <div className="hb-paper" aria-hidden="true" />

          <h1 className="hb-head">
            <span className="ln"><span className="li">Some things</span></span>
            <span className="ln"><span className="li">deserve to</span></span>
            <span className="ln"><span className="li">be <em>kept.</em></span></span>
          </h1>

          <div className="hb-desk" aria-label="Specimen sheets">
            {SPECIMENS.map((s, i) => (
              <div
                key={s.no}
                data-card
                className={`hb-card${flipped.has(i) ? ' is-flipped' : ''}${i === FEATURE ? ' is-feature' : ''}`}
              >
                <div className="hb-card__inner">
                  <div className="hb-card__face hb-card__front">
                    <div className="hb-card__photo">
                      {!broken.has(i) && <img src={s.src} alt={`Pressed specimen: ${s.common}`} draggable={false} />}
                    </div>
                    <div className="hb-card__label">
                      <span className="hb-card__no">No. {s.no}</span>
                      <span className="hb-card__name">{s.latin}</span>
                    </div>
                    <i className={`hb-tape hb-tape--${s.tape}`} aria-hidden="true" />
                  </div>
                  <div className="hb-card__face hb-card__back" aria-hidden={!flipped.has(i)}>
                    <span className="hb-card__kicker">Catalogue entry · {s.no}/12</span>
                    <span className="hb-card__latin">{s.latin}</span>
                    <span className="hb-card__common">{s.common}</span>
                    <dl>
                      <dt>Pressed</dt><dd>{s.pressed}</dd>
                      <dt>Found</dt><dd>{s.place}</dd>
                    </dl>
                    <p className="hb-card__note">“{s.note}”</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hb-card__key"
                  aria-pressed={flipped.has(i)}
                  aria-label={`Turn over sheet ${s.no}, ${s.common}`}
                  onClick={(e) => e.detail === 0 && flip(i)} /* keyboard only; pointer taps are handled by the desk */
                />
              </div>
            ))}
          </div>

          <div ref={coverRef} className="hb-cover" aria-hidden="true">
            <img src={SPECIMENS[FEATURE].src} alt="" draggable={false} />
          </div>

          <header className="hb-top">
            <span>Oversight Supply</span>
            <span className="hb-top__c">Herbarium <em>Vol. III</em></span>
            <span className="hb-top__r">Sheets read <b>{count}</b>/12</span>
          </header>

          <div className="hb-aside">
            <p className="hb-aside__in">
              Twelve pressings from one June.{' '}
              {isTouch ? 'Drag to throw them around, tap one to read its back.' : 'Throw them around. Click one to read its back.'}
            </p>
          </div>

          <div className="hb-dock">
            <div className="hb-dock__in">
              <button type="button" onClick={() => engineRef.current?.shuffle()} disabled={!ready}>Shuffle</button>
              <button type="button" onClick={() => scrollToProgress(SORTED_AT)} disabled={!ready}>Sort the sheets ↓</button>
            </div>
          </div>

          <div className="hb-index" aria-hidden="true">
            <p className="hb-index__kicker">Index of specimens · 12 sheets</p>
            <p className="hb-index__title">One summer, <em>filed flat.</em></p>
          </div>

          <div className="hb-final">
            <p className="hb-final__kicker">No. {SPECIMENS[FEATURE].no} · {SPECIMENS[FEATURE].latin} · pressed {SPECIMENS[FEATURE].pressed}</p>
            <h2 className="hb-final__title">Kept.</h2>
            <p className="hb-final__body">{SPECIMENS[FEATURE].note}</p>
            <button type="button" className="hb-final__btn" onClick={scatterAgain}>
              Scatter them again <span aria-hidden="true">↑</span>
            </button>
          </div>

          {!ready && (
            <div className="hb-loader" role="status">
              Pressing sheets {String(loaded).padStart(2, '0')}/12
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
