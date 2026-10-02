/**
 * Case studies behind the books. Content lives in /content/projects/*.json and is
 * edited in the CMS at /admin under "Projects"; images are uploaded to /public/uploads.
 */
import { BASE } from './objects'

export type GalleryImage = { image: string; caption: string }

export type Project = {
  slug: string
  order: number
  title: string
  subtitle: string
  /** front cover image (the shelf and the case study hero) */
  cover: string
  /** spine image, shown on the side of the book */
  spine: string
  year: string
  client: string
  role: string
  intro: string
  body: string
  gallery: GalleryImage[]
  link: { label: string; url: string } | null
}

type ProjectFile = Partial<Omit<Project, 'gallery' | 'link'>> & {
  gallery?: Partial<GalleryImage>[]
  link?: { label?: string; url?: string }
}

const files = import.meta.glob<ProjectFile>('../../content/projects/*.json', { eager: true, import: 'default' })

/** "/uploads/x.webp" from the CMS → the address it has on this host (e.g. /portfolio/uploads/x.webp) */
export const assetUrl = (path: string) => {
  const prefix = import.meta.env.BASE_URL // "/", "/portfolio/", or "./" for a relative build
  return path.startsWith('/') && !path.startsWith(prefix) ? prefix + path.slice(1) : path
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const normalise = (f: ProjectFile, i: number): Project => {
  const title = f.title?.trim() || `Project ${i + 1}`
  const url = f.link?.url?.trim() ?? ''
  return {
    slug: slugify(f.slug?.trim() || title),
    order: f.order ?? i + 1,
    title,
    subtitle: f.subtitle?.trim() ?? '',
    cover: f.cover ? assetUrl(f.cover) : '',
    spine: f.spine ? assetUrl(f.spine) : '',
    year: f.year?.trim() ?? '',
    client: f.client?.trim() ?? '',
    role: f.role?.trim() ?? '',
    intro: f.intro ?? '',
    body: f.body ?? '',
    gallery: (f.gallery ?? []).filter((g) => g?.image).map((g) => ({ image: assetUrl(g.image!), caption: g.caption ?? '' })),
    link: url ? { label: f.link?.label?.trim() || url, url } : null,
  }
}

export const PROJECTS: Project[] = Object.values(files)
  .map(normalise)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

export const projectHref = (slug: string) => `${BASE}books/${encodeURIComponent(slug)}`

/** the project a page address points at, e.g. /portfolio/books/flying-high → flying-high */
export const projectFromPathname = (pathname: string): Project | null => {
  if (!pathname.startsWith(`${BASE}books/`)) return null
  const slug = decodeURIComponent(pathname.slice(`${BASE}books/`.length).replace(/\/$/, ''))
  return PROJECTS.find((p) => p.slug === slug) ?? null
}
