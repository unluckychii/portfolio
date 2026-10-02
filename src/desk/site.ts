/**
 * The site's name and the interface text around the desk. Lives in
 * /content/site.json and is edited in the CMS at /admin under "Site settings".
 */
import file from '../../content/site.json'

export type Site = {
  /** top-left of the page and the browser tab */
  name: string
  /** centre of the header; its last word is set in italics. Empty hides it */
  heading: string
  hint: string
  hintTouch: string
  hintNo3d: string
  back: string
  next: string
  lampName: string
  lampHint: string
  credits: string
  /** picture on the laptop screen; empty shows the code editor */
  laptopScreen: string
}

const DEFAULTS: Site = {
  name: "Aaron's Desk",
  heading: 'The desk',
  hint: 'Drag to look around · click an object',
  hintTouch: 'Drag · tap an object',
  hintNo3d: 'Pick an object',
  back: 'Back to the desk',
  next: 'Next on the desk',
  lampName: 'The lamp',
  lampHint: 'Click to switch',
  credits: '3D model credits',
  laptopScreen: '',
}

const f = file as Partial<Record<keyof Site, unknown>>
const text = (k: keyof Site, allowEmpty = false) => {
  const v = typeof f[k] === 'string' ? (f[k] as string).trim() : undefined
  return v === undefined || (!v && !allowEmpty) ? DEFAULTS[k] : v
}

/** anything missing from the file falls back to the defaults, so the page never shows a blank */
export const SITE: Site = {
  name: text('name'),
  heading: text('heading', true),
  hint: text('hint'),
  hintTouch: text('hintTouch'),
  hintNo3d: text('hintNo3d'),
  back: text('back'),
  next: text('next'),
  lampName: text('lampName'),
  lampHint: text('lampHint', true),
  credits: text('credits'),
  laptopScreen: text('laptopScreen', true),
}
