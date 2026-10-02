import { useEffect, useRef, useState } from 'react'

const PREF = 'desk-music' // remembers a visitor who turned the music off
const VOLUME = 0.35

const readPref = () => {
  try {
    return localStorage.getItem(PREF)
  } catch {
    return null
  }
}
const writePref = (v: 'on' | 'off') => {
  try {
    localStorage.setItem(PREF, v)
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

/**
 * Background music with a play/pause button for the header.
 * It tries to start straight away; browsers usually block sound until the visitor
 * interacts with the page, so in that case it starts on their first click, tap or key.
 */
export default function Music({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const a = new Audio(src)
    a.loop = true
    a.volume = VOLUME
    a.preload = 'auto'
    audio.current = a
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)

    // the first interaction anywhere except the button (which decides for itself)
    const start = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.dk-music')) return
      stopWaiting()
      a.play().catch(() => {})
    }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const stopWaiting = () => events.forEach((n) => window.removeEventListener(n, start, true))

    if (readPref() !== 'off') {
      a.play().catch(() => events.forEach((n) => window.addEventListener(n, start, { capture: true, passive: true })))
    }
    return () => {
      stopWaiting()
      a.pause()
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.src = ''
      audio.current = null
    }
  }, [src])

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) {
      writePref('on')
      a.play().catch(() => {})
    } else {
      writePref('off')
      a.pause()
    }
  }

  return (
    <button
      type="button"
      className="dk-music"
      aria-pressed={playing}
      aria-label={playing ? 'Pause the music' : 'Play the music'}
      title={playing ? 'Pause the music' : 'Play the music'}
      data-playing={playing ? '' : undefined}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
        <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
        {!playing && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
      <span className="dk-music__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  )
}
