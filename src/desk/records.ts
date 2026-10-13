/**
 * The records the turntable can play. They live in /content/records.json and are
 * edited in the CMS at /admin under "Records"; audio and sleeves upload to /public/uploads/records.
 */
import file from '../../content/records.json'
import { assetUrl } from './projects'
import { SITE } from './site'

export type Vinyl = {
  title: string
  artist: string
  /** the audio file */
  src: string
  /** sleeve artwork; empty draws a plain sleeve in the record's colour */
  cover: string
  colour: string
}

type RecordsFile = { records?: { title?: string; artist?: string; audio?: string; cover?: string; colour?: string }[] }

const COLOURS = ['#c9a227', '#b5452f', '#3c6e71', '#6b4e9b', '#2f5d8a', '#8a5a2f']

const listed: Vinyl[] = ((file as RecordsFile).records ?? [])
  .filter((r) => r?.audio?.trim())
  .map((r, i) => ({
    title: r.title?.trim() || `Record ${i + 1}`,
    artist: r.artist?.trim() ?? '',
    src: assetUrl(r.audio!.trim()),
    cover: r.cover?.trim() ? assetUrl(r.cover.trim()) : '',
    colour: /^#[0-9a-f]{3,8}$/i.test(r.colour?.trim() ?? '') ? r.colour!.trim() : COLOURS[i % COLOURS.length],
  }))

/** the records, or the site's one music file if none are listed yet */
export const RECORDS: Vinyl[] =
  listed.length > 0
    ? listed
    : SITE.music
      ? [{ title: 'Background music', artist: '', src: assetUrl(SITE.music), cover: '', colour: COLOURS[0] }]
      : []
