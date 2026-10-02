/**
 * The clothes rail on the laptop's page. Lives in /content/rail.json and is edited
 * in the CMS at /admin under "Clothes rail"; images upload to /public/uploads/rail.
 */
import file from '../../content/rail.json'
import { assetUrl } from './projects'

export type Garment = { name: string; note: string; image: string }

type RailFile = { title?: string; items?: { name?: string; note?: string; image?: string }[] }
const f = file as RailFile

export const RAIL_TITLE = f.title?.trim() ?? ''

export const GARMENTS: Garment[] = (f.items ?? [])
  .filter((g) => g?.image)
  .map((g, i) => ({ name: g.name?.trim() || `Piece ${i + 1}`, note: g.note?.trim() ?? '', image: assetUrl(g.image!) }))
