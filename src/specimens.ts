/**
 * Sheet content lives in /content/sheets/*.json and is edited through the
 * CMS at /admin (Decap). Images are uploaded to /public/uploads.
 */

export type Fact = { label: string; value: string }
export type GalleryItem = { image: string; caption?: string }

export type ProjectPage = {
  enabled: boolean
  label: string
  title: string
  intro: string
  facts: Fact[]
  link: { label: string; url: string } | null
  body: string
  gallery: GalleryItem[]
}

export type Specimen = {
  no: string
  latin: string
  common: string
  src: string
  pressed: string
  place: string
  note: string
  tape: 'top' | 'corners' | 'side'
  feature: boolean
  more: ProjectPage
}

/** shape of a JSON file as the CMS writes it: anything may be missing */
type SheetFile = Partial<Omit<Specimen, 'src' | 'more'>> & {
  image?: string
  more?: Partial<Omit<ProjectPage, 'link'>> & { link?: { label?: string; url?: string } }
}

const files = import.meta.glob<SheetFile>('../content/sheets/*.json', { eager: true, import: 'default' })

const TAPES = ['top', 'corners', 'side'] as const

const normalise = (f: SheetFile, i: number): Specimen => {
  const m = f.more ?? {}
  const url = m.link?.url?.trim() ?? ''
  return {
    no: String(f.no ?? i + 1).padStart(2, '0'),
    latin: f.latin ?? '',
    common: f.common ?? '',
    src: f.image ?? '',
    pressed: f.pressed ?? '',
    place: f.place ?? '',
    note: f.note ?? '',
    tape: TAPES.includes(f.tape as Specimen['tape']) ? (f.tape as Specimen['tape']) : TAPES[i % 3],
    feature: !!f.feature,
    more: {
      enabled: !!m.enabled,
      label: m.label?.trim() || 'View the project',
      title: m.title?.trim() || f.common || f.latin || '',
      intro: m.intro ?? '',
      facts: (m.facts ?? []).filter((x) => x?.label || x?.value),
      link: url ? { label: m.link?.label?.trim() || url, url } : null,
      body: m.body ?? '',
      gallery: (m.gallery ?? []).filter((g) => g?.image),
    },
  }
}

export const SPECIMENS: Specimen[] = Object.values(files)
  .map(normalise)
  .sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true }))

export const TOTAL = String(SPECIMENS.length).padStart(2, '0')

/** the sheet the camera dives into at the end of the scroll (first one marked as the finale) */
export const FEATURE = Math.max(0, SPECIMENS.findIndex((s) => s.feature))

export const projectHref = (s: Specimen) => `/sheets/${encodeURIComponent(s.no)}`
