/**
 * Pages behind the objects on the 3D desk. Content lives in /content/desk/*.json
 * and is edited through the CMS at /admin (Decap), like the herbarium sheets.
 */

export type DeskId = 'monitor' | 'coffee' | 'books' | 'pigeon'
export type DeskLink = { label: string; url: string }

export type DeskObject = {
  id: DeskId
  order: number
  /** name shown when hovering the object */
  label: string
  /** one word under the name, e.g. "Work" */
  hint: string
  kicker: string
  title: string
  intro: string
  body: string
  links: DeskLink[]
}

type DeskFile = Partial<Omit<DeskObject, 'links'>> & { links?: Partial<DeskLink>[] }

const files = import.meta.glob<DeskFile>('../../content/desk/*.json', { eager: true, import: 'default' })

const IDS: DeskId[] = ['monitor', 'coffee', 'books', 'pigeon']

const normalise = (f: DeskFile, id: DeskId): DeskObject => ({
  id,
  order: f.order ?? IDS.indexOf(id) + 1,
  label: f.label?.trim() || id,
  hint: f.hint?.trim() ?? '',
  kicker: f.kicker ?? '',
  title: f.title?.trim() || f.label?.trim() || id,
  intro: f.intro ?? '',
  body: f.body ?? '',
  links: (f.links ?? [])
    .filter((l) => l?.url?.trim())
    .map((l) => ({ label: l.label?.trim() || l.url!.trim(), url: l.url!.trim() })),
})

const byId = new Map<DeskId, DeskFile>()
for (const f of Object.values(files)) if (f.id && IDS.includes(f.id)) byId.set(f.id, f)

/** every object on the desk has a page, even if its file is missing */
export const DESK_OBJECTS: DeskObject[] = IDS.map((id) => normalise(byId.get(id) ?? {}, id)).sort(
  (a, b) => a.order - b.order,
)

export const isDeskId = (v: string | undefined): v is DeskId => !!v && (IDS as string[]).includes(v)

export const deskHref = (id?: DeskId) => (id ? `/desk/${id}` : '/desk')
