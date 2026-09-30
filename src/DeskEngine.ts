/**
 * DeskEngine — paper-on-a-table physics for a pile of DOM cards, plus the
 * scroll choreography (pile → index grid → camera dive into one sheet).
 *
 * Cards are plain DOM elements; every frame the engine writes a single
 * transform per card. Positions are card centres in stage pixels.
 */

// card geometry, as fractions of card width (must match herbarium.css)
export const CARD_H = 1.4
const PHOTO_W = 0.88
const PHOTO_H = 1.1
const PHOTO_CY = 0.06 + PHOTO_H / 2 - CARD_H / 2 // photo centre relative to card centre

const LIN_DRAG = 4.2 // 1/s — how quickly a thrown sheet slides to rest
const ANG_DRAG = 5
const STAGGER = 0.045 // sort: each card leaves the pile a little after the previous one

type Card = {
  el: HTMLElement
  x: number
  y: number
  a: number
  vx: number
  vy: number
  va: number
  hx: number // pile home (normalised 0..1)
  hy: number
  ha: number
  gx: number // index-grid slot (px)
  gy: number
  spawnAt: number // seconds; card is off-table until then
  inside: boolean
  z: number
}

type Drag = {
  card: Card
  id: number
  lx: number // grab point in card-local coords
  ly: number
  px: number
  py: number
  sx: number // start point, for tap detection
  sy: number
  moved: number
  t: number
  svx: number
  svy: number
  sva: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export type Mode = 'pile' | 'index' | 'zoom'

export class DeskEngine {
  cards: Card[] = []
  w = 1
  h = 1
  cw = 200
  gridScale = 1
  sort = 0
  zoom = 0
  feature: number
  reduced = false
  mode: Mode = 'pile'
  onMode?: (m: Mode) => void
  private drag: Drag | null = null
  private topZ = 20
  private clock = 0
  private cover: HTMLElement | null
  private stage: HTMLElement

  constructor(stage: HTMLElement, els: HTMLElement[], cover: HTMLElement | null, feature: number) {
    this.stage = stage
    this.cover = cover
    this.feature = feature
    this.cards = els.map((el, i) => ({
      el, x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, hx: 0.5, hy: 0.5, ha: 0,
      gx: 0, gy: 0, spawnAt: 0, inside: false, z: i + 1,
    }))
    this.pickHomes()
  }

  /* ------------------------------------------------------------ layout */
  private get mobile() {
    return this.w < 700
  }

  /** scattered but even: one jittered cell per card inside the table area */
  private pickHomes() {
    const n = this.cards.length
    const cols = this.w < 700 ? 3 : 4
    const rows = Math.ceil(n / cols)
    const order = this.cards.map((_, i) => i).sort(() => Math.random() - 0.5)
    order.forEach((ci, k) => {
      const c = this.cards[ci]
      const col = k % cols
      const row = Math.floor(k / cols)
      c.hx = (col + 0.5 + rnd(-0.32, 0.32)) / cols
      c.hy = (row + 0.5 + rnd(-0.3, 0.3)) / rows
      c.ha = rnd(-0.38, 0.38)
    })
  }

  /** pile area in px (desktop leaves the headline corner mostly clear) */
  private homePx(c: Card) {
    const { w, h } = this
    if (this.mobile) return { x: w * (0.14 + c.hx * 0.72), y: h * (0.36 + c.hy * 0.42) }
    return { x: w * (0.36 + c.hx * 0.57), y: h * (0.2 + c.hy * 0.6) }
  }

  resize(w: number, h: number) {
    const ow = this.w
    const oh = this.h
    this.w = w
    this.h = h
    this.cw = this.mobile ? clamp(w * 0.3, 96, 150) : clamp(Math.min(w * 0.13, h * 0.22), 130, 230)
    this.stage.style.setProperty('--cw', `${this.cw}px`)
    // keep thrown cards where they were, proportionally
    for (const c of this.cards) {
      c.x *= w / ow
      c.y *= h / oh
    }
    this.layoutGrid()
    this.layoutCover()
  }

  private layoutGrid() {
    const n = this.cards.length
    const { w, h } = this
    const top = this.mobile ? 118 : 150
    const bottom = this.mobile ? 40 : 56
    const side = this.mobile ? 16 : Math.max(32, w * 0.06)
    const gap = this.mobile ? 10 : 18
    const availW = w - side * 2
    const availH = h - top - bottom
    let best = { cols: 4, size: 0 }
    for (let cols = 2; cols <= 8; cols++) {
      const rows = Math.ceil(n / cols)
      const size = Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows / CARD_H)
      if (size > best.size) best = { cols, size }
    }
    const { cols, size } = best
    const rows = Math.ceil(n / cols)
    const gridW = cols * size + (cols - 1) * gap
    const gridH = rows * size * CARD_H + (rows - 1) * gap
    const x0 = (w - gridW) / 2 + size / 2
    const y0 = top + (availH - gridH) / 2 + (size * CARD_H) / 2
    this.gridScale = size / this.cw
    this.cards.forEach((c, i) => {
      c.gx = x0 + (i % cols) * (size + gap)
      c.gy = y0 + Math.floor(i / cols) * (size * CARD_H + gap)
    })
  }

  /** the final full-bleed image sits exactly where the zoomed photo lands */
  private get coverScale() {
    const pw = PHOTO_W * this.cw * this.gridScale
    const ph = PHOTO_H * this.cw * this.gridScale
    return Math.max(this.w / pw, this.h / ph) * 1.002
  }

  private layoutCover() {
    if (!this.cover) return
    const s = this.coverScale
    const pw = PHOTO_W * this.cw * this.gridScale * s
    const ph = PHOTO_H * this.cw * this.gridScale * s
    Object.assign(this.cover.style, {
      width: `${pw}px`,
      height: `${ph}px`,
      left: `${(this.w - pw) / 2}px`,
      top: `${(this.h - ph) / 2}px`,
    })
  }

  /* ----------------------------------------------------------- tossing */
  /** throw every sheet onto the table from below the fold */
  deal() {
    this.clock = 0
    this.cards.forEach((c, i) => {
      const home = this.homePx(c)
      const sx = home.x + rnd(-0.2, 0.2) * this.w
      const sy = this.h + this.cw * CARD_H
      if (this.reduced) {
        Object.assign(c, { x: home.x, y: home.y, a: c.ha, vx: 0, vy: 0, va: 0, inside: true, spawnAt: 0 })
        return
      }
      c.x = sx
      c.y = sy
      c.inside = false
      c.spawnAt = 0.15 + i * 0.075
      this.launch(c, home.x, home.y, c.ha)
    })
  }

  /** re-scatter from wherever the cards are now */
  shuffle() {
    this.drag = null
    this.pickHomes()
    this.cards.forEach((c, i) => {
      const home = this.homePx(c)
      if (this.reduced) {
        Object.assign(c, { x: home.x, y: home.y, a: c.ha, vx: 0, vy: 0, va: 0 })
        return
      }
      c.spawnAt = this.clock + i * 0.03
      this.launch(c, home.x, home.y, c.ha + rnd(-0.6, 0.6))
    })
  }

  /** velocity that makes exponential drag bring the card to rest exactly at (tx, ty, ta) */
  private launch(c: Card, tx: number, ty: number, ta: number) {
    c.vx = (tx - c.x) * LIN_DRAG
    c.vy = (ty - c.y) * LIN_DRAG
    const spin = rnd(-1.4, 1.4)
    c.a = ta - spin
    c.va = spin * ANG_DRAG
  }

  /* ---------------------------------------------------------- dragging */
  get interactive() {
    return this.sort < 0.002
  }

  cardAt(el: Element | null) {
    const node = el?.closest<HTMLElement>('[data-card]')
    return node ? this.cards.find((c) => c.el === node) ?? null : null
  }

  grab(el: Element | null, id: number, px: number, py: number) {
    if (!this.interactive) return false
    const c = this.cardAt(el)
    if (!c) return false
    const dx = px - c.x
    const dy = py - c.y
    const cos = Math.cos(-c.a)
    const sin = Math.sin(-c.a)
    this.drag = {
      card: c, id, px, py, sx: px, sy: py, moved: 0, t: performance.now(),
      lx: dx * cos - dy * sin, ly: dx * sin + dy * cos, svx: 0, svy: 0, sva: 0,
    }
    c.vx = c.vy = c.va = 0
    c.inside = true
    c.spawnAt = 0
    c.z = ++this.topZ
    c.el.classList.add('is-held')
    return true
  }

  move(id: number, px: number, py: number) {
    const d = this.drag
    if (!d || d.id !== id) return
    const c = d.card
    const now = performance.now()
    const dt = Math.max(1, now - d.t) / 1000
    const mx = px - d.px
    const my = py - d.py
    d.moved += Math.abs(mx) + Math.abs(my)
    // torque: pulling a sheet off-centre swings it around the grab point
    const rx = d.px - c.x
    const ry = d.py - c.y
    const lever = this.cw * 0.9
    const da = clamp(((rx * my - ry * mx) / (rx * rx + ry * ry + lever * lever)) * 0.9, -0.25, 0.25)
    const ox = c.x
    const oy = c.y
    c.a += da
    const cos = Math.cos(c.a)
    const sin = Math.sin(c.a)
    c.x = px - (d.lx * cos - d.ly * sin)
    c.y = py - (d.lx * sin + d.ly * cos)
    const k = 1 - Math.exp(-dt * 18) // smoothed release velocity
    d.svx += ((c.x - ox) / dt - d.svx) * k
    d.svy += ((c.y - oy) / dt - d.svy) * k
    d.sva += (da / dt - d.sva) * k
    d.px = px
    d.py = py
    d.t = now
  }

  /** returns true when the gesture was a tap (so the card should flip) */
  release(id: number) {
    const d = this.drag
    if (!d || d.id !== id) return false
    const c = d.card
    c.el.classList.remove('is-held')
    this.drag = null
    // a pause before letting go kills the throw, like real paper
    const idle = performance.now() - d.t > 90
    if (!this.reduced && !idle) {
      const max = 4200
      const sp = Math.hypot(d.svx, d.svy)
      const f = sp > max ? max / sp : 1
      c.vx = d.svx * f
      c.vy = d.svy * f
      c.va = clamp(d.sva, -14, 14)
    }
    return d.moved < 7
  }

  cancel() {
    if (this.drag) this.drag.card.el.classList.remove('is-held')
    this.drag = null
  }

  /* ------------------------------------------------------------- frame */
  setStory(sort: number, zoom: number) {
    this.sort = sort
    this.zoom = zoom
    if (!this.interactive) this.cancel()
    const mode: Mode = zoom > 0.02 ? 'zoom' : sort > 0.002 ? 'index' : 'pile'
    if (mode !== this.mode) {
      this.mode = mode
      this.onMode?.(mode)
    }
  }

  step(dt: number) {
    dt = Math.min(dt, 1 / 30)
    this.clock += dt
    const { w, h, cw } = this
    const m = cw * 0.32
    for (const c of this.cards) {
      if (this.drag?.card === c || this.clock < c.spawnAt) continue
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.a += c.va * dt
      const lin = Math.exp(-LIN_DRAG * dt)
      c.vx *= lin
      c.vy *= lin
      c.va *= Math.exp(-ANG_DRAG * dt)
      if (!c.inside) {
        if (c.y < h - m && c.x > m && c.x < w - m) c.inside = true
        continue
      }
      // table edges: sheets bounce softly and may hang over a little
      if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx) * 0.45; c.va += c.vy * 0.002 }
      if (c.x > w - m) { c.x = w - m; c.vx = -Math.abs(c.vx) * 0.45; c.va -= c.vy * 0.002 }
      if (c.y < m + 50) { c.y = m + 50; c.vy = Math.abs(c.vy) * 0.45; c.va -= c.vx * 0.002 }
      if (c.y > h - m) { c.y = h - m; c.vy = -Math.abs(c.vy) * 0.45; c.va += c.vx * 0.002 }
    }
    this.render()
  }

  render() {
    const { w, h, cw, cards, feature } = this
    const n = cards.length
    const span = 1 - STAGGER * (n - 1)
    // camera dive (exponential zoom so it feels even from start to finish)
    const ez = ease(this.zoom)
    const S1 = this.coverScale
    const S = Math.pow(S1, ez)
    const f = cards[feature]
    const fx = f.gx
    const fy = f.gy + PHOTO_CY * cw * this.gridScale
    const pull = S1 > 1.0001 ? (1 - 1 / S) / (1 - 1 / S1) : 0
    const tx = w / 2 + (fx - w / 2) * pull
    const ty = h / 2 + (fy - h / 2) * pull
    const fade = 1 - clamp((ez - 0.15) / 0.4, 0, 1)

    cards.forEach((c, i) => {
      const t = ease(clamp((this.sort - i * STAGGER) / span, 0, 1))
      // shortest way back to upright
      const a0 = Math.atan2(Math.sin(c.a), Math.cos(c.a))
      let x = c.x + (c.gx - c.x) * t
      let y = c.y + (c.gy - c.y) * t
      const a = a0 * (1 - t)
      let s = 1 + (this.gridScale - 1) * t
      s *= 1 + Math.sin(Math.PI * t) * 0.12 // lifted off the table on the way
      x = w / 2 + (x - tx) * S
      y = h / 2 + (y - ty) * S
      s *= S
      const style = c.el.style
      style.transform = `translate3d(${(x - cw / 2).toFixed(1)}px, ${(y - (cw * CARD_H) / 2).toFixed(1)}px, 0) rotate(${a.toFixed(4)}rad) scale(${s.toFixed(4)})`
      style.zIndex = String(i === feature && this.zoom > 0 ? 999 : t > 0 && t < 1 ? 500 + i : c.z)
      style.opacity = i === feature ? '1' : fade.toFixed(3)
      style.visibility = this.clock < c.spawnAt && !c.inside ? 'hidden' : 'visible'
    })
    if (this.cover) this.cover.style.opacity = clamp((this.zoom - 0.86) / 0.1, 0, 1).toFixed(3)
  }
}
