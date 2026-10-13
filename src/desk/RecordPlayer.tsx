import { useEffect, useRef, useState } from 'react'
import { pickRecord, toggleMusic, useMusicState } from './Music'
import { RECORDS, type Vinyl } from './records'
import { RecordPlayerScene } from './RecordPlayerScene'

/** a record's sleeve in the crate: its album art, or a plain sleeve in its colour */
function Sleeve({ record }: { record: Vinyl }) {
  return record.cover ? (
    <img className="rp__art" src={record.cover} alt="" loading="lazy" draggable={false} />
  ) : (
    <span className="rp__art rp__art--plain" style={{ background: record.colour }}>
      <span>{record.title}</span>
    </span>
  )
}

/**
 * The record player: a 3D suitcase turntable playing the site's music, with the records from
 * the CMS beside it. Picking a sleeve puts that record on; clicking the player plays or pauses.
 */
export default function RecordPlayer() {
  const { playing, index } = useMusicState()
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<RecordPlayerScene | null>(null)
  const [flat, setFlat] = useState(false)
  const first = useRef(index)

  useEffect(() => {
    const el = host.current
    if (!el || RECORDS.length === 0) return
    let s: RecordPlayerScene
    try {
      s = new RecordPlayerScene(el, RECORDS, first.current)
    } catch (err) {
      console.warn('The record player could not start in 3D; showing the records only.', err)
      setFlat(true)
      return
    }
    s.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    s.onClick = toggleMusic
    s.ready.catch((err) => {
      console.warn('The record player model could not load; showing the records only.', err)
      setFlat(true)
    })
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => {
    scene.current?.setRecord(index)
  }, [index])
  useEffect(() => {
    scene.current?.setPlaying(playing)
  }, [playing])

  if (RECORDS.length === 0) return null
  const current = RECORDS[index]
  return (
    <div className="rp">
      {!flat && <div ref={host} className="rp__3d" role="img" aria-label={`A record player${current ? `, with ${current.title} on` : ''}`} />}
      {current && (
        <div className="rp__now">
          <span className="rp__now-text">
            <span className="dk-kicker">{playing ? 'Now playing' : 'On the turntable'}</span>
            <span className="rp__now-title">{current.title}</span>
            {current.artist && <span className="rp__now-artist">{current.artist}</span>}
          </span>
          <button type="button" className="dk-btn rp__play" onClick={toggleMusic} aria-pressed={playing}>
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      )}
      {RECORDS.length > 1 && (
        <ul className="rp__crate" aria-label="Records">
          {RECORDS.map((r, i) => {
            const on = i === index
            return (
              <li key={r.src + i}>
                <button
                  type="button"
                  className="rp__item"
                  data-on={on ? '' : undefined}
                  aria-current={on ? 'true' : undefined}
                  aria-label={`${r.title}${r.artist ? `, ${r.artist}` : ''}${on ? (playing ? ' (playing)' : ' (on the turntable)') : ''}`}
                  onClick={() => (on ? toggleMusic() : pickRecord(i))}
                >
                  <Sleeve record={r} />
                  <span className="rp__name">{r.title}</span>
                  {r.artist && <span className="rp__artist">{r.artist}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
