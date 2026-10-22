/**
 * The loading screen (#loader in index.html): it covers the page while the desk loads, its
 * bar following the bytes of every file the desk waits for, and fades away once they're in.
 */

/** a file's size before the server says it (most of the desk's files are about this) */
const GUESS = 250_000

/** where the bar starts (the page has arrived) and how far it goes before the reveal fills it */
const START = 0.06
const END = 0.97

type File = { loaded: number; total: number; done: boolean }
const files = new Map<string, File>()

/** how much of the bytes are in (the page's own markup starts the bar at 6%) */
let target = START
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
  const p = START + (1 - START) * (total ? loaded / total : 0)
  target = Math.max(target, Math.min(p, END)) // never backwards, and full only on reveal
  start()
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** a repeat visit this session (index.html sets the flag): the screen lifts quickly */
const quick = () => 'quick' in document.documentElement.dataset

/*
 * The line and the cat glide by animations the browser runs on its own, so they keep moving
 * smoothly even while the page is busy (parsing the script, decoding the models). The bytes
 * never set where they are, only how fast they go: behind, they hurry; ahead, they slow to a
 * crawl, but they never stop or go back.
 */
/** how long the walk from start to end takes at normal speed */
const PACE = 9000
const MAX_RATE = 4
const MIN_RATE = 0.1

let moves: Animation[] = []
let rate = 1
let timer = 0

const parts = () => {
  const loader = el()
  return {
    loader,
    fill: loader?.querySelector<HTMLElement>('.ld-fill') ?? null,
    path: loader?.querySelector<HTMLElement>('.ld-path') ?? null,
    legs: loader?.querySelector<HTMLElement>('.ld-cat i') ?? null,
  }
}

/** the line and the cat, from one point on the bar to another */
function glide(from: number, to: number, options: KeyframeAnimationOptions) {
  const { fill, path } = parts()
  if (!fill || !path) return []
  return [
    fill.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], options),
    path.animate([{ transform: `translateX(${from * 100}%)` }, { transform: `translateX(${to * 100}%)` }], options),
  ]
}

/** how far along the bar the line and cat are now */
function position() {
  const a = moves[0]
  if (!a) return START
  const t = Number(a.currentTime ?? 0)
  return START + (END - START) * Math.min(1, t / PACE)
}

function start() {
  if (moves.length || timer || revealed || !el()) return
  if (reduced()) {
    timer = window.setInterval(() => show(target), 150)
    return
  }
  moves = glide(START, END, { duration: PACE, easing: 'linear', fill: 'forwards' })
  const tick = () => {
    if (revealed) return
    steer()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  timer = window.setInterval(steer, 150) // in case frames are held back
}

/** match the speed to the bytes: easing towards hurrying when behind, crawling when ahead */
function steer() {
  if (revealed || !moves.length) return
  const p = position()
  const gap = target - p
  let want = gap > 0 ? Math.min(MAX_RATE, 1 + gap * 14) : Math.max(MIN_RATE, 1 + gap * 9)
  want *= Math.min(1, Math.max(0.15, (END - p) / 0.08)) // slowing as it nears the end of the bar
  rate += (want - rate) * 0.08
  for (const a of moves) a.updatePlaybackRate(rate)
  const { loader, legs } = parts()
  // the cat's legs keep time with how fast it's going, and if it reaches the end before the desk
  // is ready it stands and waits there rather than walking on the spot
  legs?.getAnimations()[0]?.updatePlaybackRate(Math.min(1.5, Math.max(0.5, rate)))
  if (loader) loader.toggleAttribute('data-waiting', moves[0].playState === 'finished')
  show(p)
}

/** the percentage, for the eye and for screen readers */
function show(p: number) {
  const { loader, fill, path } = parts()
  if (!loader) return
  const pct = Math.round(p * 100)
  loader.style.setProperty('--pct', String(pct))
  loader.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(pct))
  if (reduced() && fill && path) {
    fill.style.transform = `scaleX(${p})`
    path.style.transform = `translateX(${p * 100}%)`
  }
}

/** show the site's heading (set in the CMS) on the screen in place of the page's built-in one */
export function nameLoader(name: string) {
  const p = el()?.querySelector('.ld-name')
  if (!p || !name) return
  // its last word in italics, like the header's
  const i = name.lastIndexOf(' ')
  const em = document.createElement('em')
  em.textContent = name.slice(i + 1)
  p.replaceChildren(name.slice(0, i + 1), em)
}

/** run the line and the cat to the end from wherever they are, then lift the screen */
export function reveal() {
  if (revealed) return
  revealed = true
  try {
    sessionStorage.setItem('desk-seen', '1') // a refresh later this visit gets the quick lift
  } catch {
    // storage blocked: every visit gets the full screen
  }
  window.clearInterval(timer)
  const from = position()
  // a repeat visit lifts straight away, leaving the line and cat where they are
  if (quick()) return done()
  for (const a of moves) a.cancel()
  moves = []
  el()?.removeAttribute('data-waiting')
  show(1)
  if (reduced() || !el()) return done()
  // the further it has to go, the longer the run, so a quick load doesn't send the cat dashing
  const run = Math.round(350 + 650 * (1 - from))
  const finish = glide(from, 1, { duration: run, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)', fill: 'forwards' })
  parts().legs?.getAnimations()[0]?.updatePlaybackRate(1)
  let finished = false
  const end = () => {
    if (finished) return
    finished = true
    done()
  }
  if (finish[0]) finish[0].finished.then(end, end)
  setTimeout(end, run + 200) // in case the animation never reports in
}

/** the bar is full: the cat stops at the end and stands, the screen lifts, and the desk settles into view */
function done() {
  const loader = el()
  const settle = () => delete document.documentElement.dataset.loading
  if (!loader) return settle()
  if (reduced() || quick()) {
    loader.dataset.gone = ''
    settle()
    setTimeout(() => loader.remove(), 450)
    return
  }
  loader.dataset.done = ''
  setTimeout(() => {
    loader.dataset.gone = ''
    settle()
  }, 600) // a moment to see the cat at the end
  setTimeout(() => loader.remove(), 1800)
}
