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
let target = 0.06
let raf = 0
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
  if (!raf) raf = requestAnimationFrame(step)
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function step() {
  raf = 0
  shown = reduced() ? target : shown + (target - shown) * 0.18
  if (target - shown < 0.001) shown = target
  const loader = el()
  if (!loader) return
  loader.style.setProperty('--loaded', String(shown))
  loader.style.setProperty('--pct', String(Math.round(shown * 100)))
  loader.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(Math.round(shown * 100)))
  if (shown !== target) raf = requestAnimationFrame(step)
}

/** show the site's heading (set in the CMS) on the screen in place of the page's built-in one */
export function nameLoader(name: string) {
  const p = el()?.querySelector('.ld-name')
  if (p && name) p.textContent = name
}

/** fill the bar and fade the screen away */
export function reveal() {
  if (revealed) return
  revealed = true
  target = shown = 1
  step()
  const loader = el()
  if (!loader) return
  const go = () => {
    loader.dataset.gone = ''
    const remove = () => loader.remove()
    if (reduced()) remove()
    else {
      loader.addEventListener('transitionend', remove, { once: true })
      setTimeout(remove, 1200) // in case the transition never runs
    }
  }
  if (reduced()) go()
  else setTimeout(go, 250) // a moment for the full bar to show
}
