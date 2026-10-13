/**
 * Markdown from the CMS as HTML. On top of plain markdown it understands two blocks the
 * CMS editor inserts (each on its own line):
 *   {{< youtube https://youtu.be/… >}}  a YouTube video
 *   {{< anchor some-name >}}           a point on the page that links like [text](#some-name) jump to
 * Headings also get an anchor from their text, e.g. "Things I like" → #things-i-like.
 * Written by the site's editors (repo write access), so the markdown itself is trusted.
 */
import { marked } from 'marked'
import { assetUrl } from './projects'

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** the 11-character video id from any kind of YouTube link (or the id itself) */
export function youtubeId(input: string) {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const id = u.hostname.endsWith('youtu.be')
      ? u.pathname.slice(1)
      : (u.searchParams.get('v') ?? u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] ?? '')
    return /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

const video = (id: string) =>
  `<div class="dk-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" ` +
  `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
  `referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`

export function markdown(md: string) {
  const withBlocks = md
    .replace(/^[ \t]*\{\{<\s*youtube\s+(\S+)\s*>\}\}[ \t]*$/gim, (whole, url: string) => {
      const id = youtubeId(url)
      return id ? `\n${video(id)}\n` : whole
    })
    .replace(/^[ \t]*\{\{<\s*anchor\s+([^>]+?)\s*>\}\}[ \t]*$/gim, (_, name: string) => {
      const id = slug(name)
      return id ? `\n<span id="${id}" class="dk-anchor"></span>\n` : ''
    })
  return (marked.parse(withBlocks, { async: false }) as string)
    // pictures uploaded through the CMS, pointed at where the site lives (e.g. /portfolio/uploads/…)
    .replace(/(<img[^>]*\ssrc=")([^"]+)"/g, (_, pre: string, src: string) => `${pre}${assetUrl(src)}" loading="lazy"`)
    // headings get an anchor from their text
    .replace(/<(h[2-4])>(.*?)<\/\1>/g, (whole, tag: string, text: string) => {
      const id = slug(text)
      return id ? `<${tag} id="${id}">${text}</${tag}>` : whole
    })
}

/**
 * A click on a link to an anchor (#…) inside rendered markdown scrolls to it within the
 * open page, instead of changing the address (which would reopen the page).
 */
export function followAnchor(e: React.MouseEvent<HTMLElement>) {
  const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null
  if (!a) return
  const id = decodeURIComponent(a.getAttribute('href')!.slice(1))
  const target = id ? e.currentTarget.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null
  if (!target) return
  e.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
