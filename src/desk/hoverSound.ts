import { useEffect, useRef } from 'react'

const VOLUME = 0.5

/** the visitor turned sound off with the music button */
const muted = () => {
  try {
    return localStorage.getItem('desk-music') === 'off'
  } catch {
    return false
  }
}

/**
 * A short sound each time `key` changes to something (an object on the desk is hovered).
 * Browsers only allow sound once the visitor has clicked, tapped or pressed a key on the
 * page, so hovers before that stay silent. Muting the music silences it too.
 */
export function useHoverSound(src: string, key: unknown) {
  const pool = useRef<HTMLAudioElement[]>([])
  const unlocked = useRef(false)

  useEffect(() => {
    if (!src) return
    // one copy to start with (fetched once, only after the visitor's first click); a second is
    // added from the browser's cache when a quick move would otherwise cut the first short
    const make = () => {
      const a = new Audio(src)
      a.preload = 'auto'
      a.volume = VOLUME
      return a
    }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const unlock = () => {
      if (!pool.current.length) pool.current = [make()] // sound can't play before this anyway
      unlocked.current = true
      events.forEach((n) => window.removeEventListener(n, unlock, true))
    }
    events.forEach((n) => window.addEventListener(n, unlock, { capture: true, passive: true }))
    return () => {
      events.forEach((n) => window.removeEventListener(n, unlock, true))
      pool.current.forEach((a) => (a.src = ''))
      pool.current = []
    }
  }, [src])

  useEffect(() => {
    if (key == null || !unlocked.current || muted()) return
    if (!pool.current.length) return
    let a = pool.current.find((x) => x.paused)
    if (!a) {
      if (pool.current.length < 2) pool.current.push((a = new Audio(pool.current[0].src)))
      else a = pool.current[0]
      a.volume = VOLUME
    }
    a.currentTime = 0
    a.play().catch(() => {})
  }, [key])
}
