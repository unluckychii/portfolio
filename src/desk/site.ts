/**
 * The site's name and the interface text around the desk. Lives in
 * /content/site.json and is edited in the CMS at /admin under "Site settings".
 */
import file from '../../content/site.json'

export type Site = {
  /** top-left of the page and the browser tab */
  name: string
  /** the icon in the browser tab (a square PNG); empty keeps the browser's default */
  favicon: string
  /** centre of the header; its last word is set in italics. Empty hides it */
  heading: string
  hint: string
  hintTouch: string
  hintNo3d: string
  back: string
  next: string
  lampName: string
  lampHint: string
  speakersName: string
  speakersHint: string
  credits: string
  /** picture on the laptop screen; empty shows the code editor */
  laptopScreen: string
  /** background music (an audio file); empty hides the music button */
  music: string
  /** short sound played when an object on the desk is hovered; empty for none */
  hoverSound: string
}

const DEFAULTS: Site = {
  name: "Aaron's Desk",
  favicon: '/uploads/favicon.png',
  heading: 'The desk',
  hint: 'Drag to look around · click an object',
  hintTouch: 'Drag · tap an object',
  hintNo3d: 'Pick an object',
  back: 'Back to the desk',
  next: 'Next on the desk',
  lampName: 'The lamp',
  lampHint: 'Click to switch',
  speakersName: 'The speakers',
  speakersHint: 'Click to play or pause the music',
  credits: '3D model credits',
  laptopScreen: '',
  music: '',
  hoverSound: '',
}

const f = file as Partial<Record<keyof Site, unknown>>
const text = (k: keyof Site, allowEmpty = false) => {
  const v = typeof f[k] === 'string' ? (f[k] as string).trim() : undefined
  return v === undefined || (!v && !allowEmpty) ? DEFAULTS[k] : v
}

/** anything missing from the file falls back to the defaults, so the page never shows a blank */
export const SITE: Site = {
  name: text('name'),
  favicon: text('favicon', true),
  heading: text('heading', true),
  hint: text('hint'),
  hintTouch: text('hintTouch'),
  hintNo3d: text('hintNo3d'),
  back: text('back'),
  next: text('next'),
  lampName: text('lampName'),
  lampHint: text('lampHint', true),
  speakersName: text('speakersName'),
  speakersHint: text('speakersHint', true),
  credits: text('credits'),
  laptopScreen: text('laptopScreen', true),
  music: text('music', true),
  hoverSound: text('hoverSound', true),
}
