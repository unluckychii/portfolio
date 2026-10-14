/**
 * The loading screen (#loader in index.html): it covers the page while the desk loads, its
 * bar following the bytes of every file the desk waits for, and fades away once they're in.
 */

/** a file's size before the server says it (most of the desk's files are about this) */
const GUESS = 250_000

type File = { loaded: number; total: number; done: boolean }
const files = new Map<string, File>()

/** the page's own markup starts the bar at 6% */
let shown = 0.06
/** how much of the bytes are in */
let target = 0.06
let raf = 0
let last = 0
let revealed = false

const el = () => document.getElementById('loader')

/** say up front which files the screen waits for, so the bar's length is right from the start */
export function expect(...urls: string[]) {
  for (const url of urls) if (!files.has(url)) files.set(url, { loaded: 0, total: GUESS, done: false })
  update()
}

/** a loader's progress callback for a file, and a call for when it has finished (or failed) */
export function track(url: string) {
  expect(url)
  const f = files.get(url)!
  return {
    onProgress(e: ProgressEvent) {
      if (e.lengthComputable && e.total > 0) f.total = e.total
      f.loaded = Math.min(e.loaded, f.total)
      update()
    },
    done() {
      f.done = true
      f.loaded = f.total
      update()
    },
  }
}

/** wait for a promise, counting its file as finished whichever way it ends */
export function tracked<T>(url: string, load: (onProgress: (e: ProgressEvent) => void) => Promise<T>) {
  const t = track(url)
  return load(t.onProgress).finally(t.done)
}

function update() {
  let loaded = 0
  let total = 0
  for (const f of files.values()) {
    loaded += f.loaded
    total += f.total
  }
  // the page itself has already arrived: the bar starts a little way along
  const p = 0.06 + 0.94 * (total ? loaded / total : 0)
  target = Math.max(target, Math.min(p, 0.99)) // never backwards, and full only on reveal
  run()
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** how quickly the bar closes on where it's heading (seconds to cover about two-thirds of the gap) */
const EASE = 0.35
/** while a file says nothing of its progress, the cat keeps ambling on a little ahead of the bytes */
const CREEP = 0.1
const CREEP_RATE = 0.25

function run() {
  if (!raf && !revealed) {
    last = performance.now()
    raf = requestAnimationFrame(step)
  }
}

function step(now: number) {
  raf = 0
  if (revealed) return
  const dt = Math.min(0.5, (now - last) / 1000)
  last = now
  if (reduced()) shown = target
  else {
    shown += (target - shown) * (1 - Math.exp(-dt / EASE))
    // a little ahead of the bytes, never quite catching up with the next file's share,
    // so the cat slows rather than stops while a file says nothing of its progress
    const ahead = Math.min(0.97, target + CREEP)
    shown += Math.max(0, ahead - shown) * CREEP_RATE * dt * 0.5
  }
  paint()
  raf = requestAnimationFrame(step) // the cat ambles on until the reveal
}

/** move the bar and the cat (CSS eases them between steps) */
function paint() {
  const loader = el()
  if (!loader) return
  const pct = Math.round(shown * 100)
  loader.style.setProperty('--loaded', shown.toFixed(4))
  loader.style.setProperty('--pct', String(pct))
  loader.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(pct))
}

/** show the site's heading (set in the CMS) on the screen in place of the page's built-in one */
export function nameLoader(name: string) {
  const p = el()?.querySelector('.ld-name')
  if (p && name) p.textContent = name
}

/** fill the bar (CSS runs it to the end, whatever the frame rate), then lift the screen */
export function reveal() {
  if (revealed) return
  revealed = true
  // the further it has to go, the longer the run, so a quick load doesn't send the cat dashing
  const run = Math.round(350 + 650 * (1 - shown))
  el()?.style.setProperty('--step', `${run}ms`)
  target = shown = 1
  cancelAnimationFrame(raf)
  raf = 0
  paint()
  if (reduced() || !el()) done()
  else setTimeout(done, run + 30)
}

/** the bar is full: the cat trots off, the screen lifts, and the desk settles into view */
function done() {
  const loader = el()
  const settle = () => delete document.documentElement.dataset.loading
  if (!loader) return settle()
  if (reduced()) {
    loader.dataset.gone = ''
    settle()
    setTimeout(() => loader.remove(), 400)
    return
  }
  loader.dataset.done = ''
  setTimeout(() => {
    loader.dataset.gone = ''
    settle()
  }, 450)
  setTimeout(() => loader.remove(), 1600)
}
