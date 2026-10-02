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
    // two copies, so a quick move from one object to the next doesn't cut the first short
    pool.current = [0, 1].map(() => {
      const a = new Audio(src)
      a.preload = 'auto'
      a.volume = VOLUME
      return a
    })
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const unlock = () => {
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
    const a = pool.current.find((x) => x.paused) ?? pool.current[0]
    if (!a) return
    a.currentTime = 0
    a.play().catch(() => {})
  }, [key])
}
