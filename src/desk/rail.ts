/**
 * The clothes rail on the laptop's page. Lives in /content/rail.json and is edited
 * in the CMS at /admin under "Clothes rail"; images upload to /public/uploads/rail.
 */
import file from '../../content/rail.json'
import { assetUrl } from './projects'
import type { FrontCrop } from './RailScene'

/**
 * front: which part of the photo prints on the 3D shirt's front (fractions); optional.
 * design: artwork printed on the 3D shirt instead; colour: the 3D shirt's colour (#hex)
 */
export type Garment = { name: string; note: string; image: string; front?: FrontCrop; design?: string; colour?: string }

type RailFile = {
  title?: string
  items?: { name?: string; note?: string; image?: string; front?: Partial<FrontCrop> | null; design?: string; colour?: string }[]
}
const f = file as RailFile

/** the CMS may leave blank numbers; keep only real fractions, defaults for the rest */
function cropOf(c: Partial<FrontCrop> | null | undefined): FrontCrop | undefined {
  if (!c) return undefined
  const d: FrontCrop = { x0: 0.24, x1: 0.76, y0: 0, y1: 1 }
  const out = { ...d }
  let any = false
  for (const k of Object.keys(d) as (keyof FrontCrop)[]) {
    const v = Number(c[k])
    if (c[k] !== undefined && c[k] !== null && (c[k] as unknown) !== '' && v >= 0 && v <= 1) {
      out[k] = v
      any = true
    }
  }
  return any && out.x1 > out.x0 && out.y1 > out.y0 ? out : undefined
}

export const RAIL_TITLE = f.title?.trim() ?? ''

export const GARMENTS: Garment[] = (f.items ?? [])
  .filter((g) => g?.image)
  .map((g, i) => ({
    name: g.name?.trim() || `Piece ${i + 1}`,
    note: g.note?.trim() ?? '',
    image: assetUrl(g.image!),
    front: cropOf(g.front),
    design: g.design?.trim() ? assetUrl(g.design.trim()) : undefined,
    colour: g.colour?.trim() || undefined,
  }))
