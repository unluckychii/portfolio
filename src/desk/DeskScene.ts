import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DeskId } from './objects'
import { currentHour, isDark, lightAt } from './daylight'
import { DeskWindow, WALL_Z, wallGeometry } from './window'

/** everything the pointer can pick: the four pages, the lamp switch and the speakers (music on/off) */
export type Pickable = DeskId | 'lamp' | 'speakers'
/** how much of the screen the page covers, from the right (x) and from the bottom (y) */
export type Cover = { x: number; y: number }

const HOME_POS = new THREE.Vector3(0.35, 1.55, 2.75)
const HOME_TARGET = new THREE.Vector3(0, 0.46, 0)
const DESK_W = 3.2
const DESK_D = 1.5
const LEG_H = 0.74

/* ------------------------------------------------------------ materials */

const std = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

/** a wood grain drawn on a canvas, so the desk needs no image files */
function woodTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#9a6a40'
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * c.height
    const amp = 2 + Math.random() * 7
    const freq = 0.004 + Math.random() * 0.01
    const phase = Math.random() * 10
    g.strokeStyle = Math.random() < 0.5 ? `rgba(70,40,18,${0.05 + Math.random() * 0.18})` : `rgba(200,150,100,${0.04 + Math.random() * 0.1})`
    g.lineWidth = 0.6 + Math.random() * 2.4
    g.beginPath()
    for (let x = 0; x <= c.width; x += 8) {
      const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.25
      if (x === 0) g.moveTo(x, yy)
      else g.lineTo(x, yy)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** soft round puff used for the coffee steam */
function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** the laptop's screen (or the stand-in monitor's): a small code editor, redrawn to blink the cursor */
class ScreenCanvas {
  canvas = document.createElement('canvas')
  texture: THREE.CanvasTexture
  private cursorOn = true
  /** a picture chosen in the CMS replaces the code editor */
  private image: HTMLImageElement | null = null
  private lines: [number, string, string][] = [
    [0, '#c792ea', 'const desk = {'],
    [1, '#9fe0a0', "coffee: 'second cup',"],
    [1, '#9fe0a0', "books: ['always', 'too many'],"],
    [1, '#f5c26b', 'pigeon: true,'],
    [1, '#82aaff', 'work: selectedProjects(),'],
    [0, '#c792ea', '}'],
    [0, '#5f6b7a', ''],
    [0, '#5f6b7a', '// click something on the desk'],
    [0, '#82aaff', 'desk.open(whatever)'],
  ]

  constructor() {
    this.canvas.width = 1024
    this.canvas.height = 664 // the laptop's display is about 3:2
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 8
    this.draw()
  }

  blink() {
    if (this.image) return
    this.cursorOn = !this.cursorOn
    this.draw()
  }

  /** show a picture on the screen instead of the code editor, cropped to fill it */
  showImage(url: string) {
    const img = new Image()
    img.onload = () => {
      this.image = img
      this.draw()
    }
    img.onerror = () => console.warn(`The laptop screen image could not be loaded: ${url}`)
    img.src = url
  }

  private draw() {
    if (this.image) {
      const g = this.canvas.getContext('2d')!
      const { width: w, height: h } = this.canvas
      const s = Math.max(w / this.image.naturalWidth, h / this.image.naturalHeight)
      const dw = this.image.naturalWidth * s
      const dh = this.image.naturalHeight * s
      g.fillStyle = '#000'
      g.fillRect(0, 0, w, h)
      g.drawImage(this.image, (w - dw) / 2, (h - dh) / 2, dw, dh)
      this.texture.needsUpdate = true
      return
    }
    const g = this.canvas.getContext('2d')!
    const { width: w, height: h } = this.canvas
    g.fillStyle = '#161b22'
    g.fillRect(0, 0, w, h)
    // title bar
    g.fillStyle = '#20262f'
    g.fillRect(0, 0, w, 44)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      g.fillStyle = col
      g.beginPath()
      g.arc(28 + i * 26, 22, 8, 0, Math.PI * 2)
      g.fill()
    })
    g.fillStyle = '#8b949e'
    g.font = '500 20px "IBM Plex Mono", ui-monospace, monospace'
    g.fillText('portfolio — desk.ts', 380, 29)
    // sidebar
    g.fillStyle = '#1b2029'
    g.fillRect(0, 44, 190, h - 44)
    g.fillStyle = '#6e7681'
    ;['src/', '  desk.ts', '  coffee.ts', '  books.ts', '  pigeon.ts', 'content/'].forEach((f, i) => {
      g.fillStyle = i === 1 ? '#d6f06b' : '#6e7681'
      g.fillText(f, 18, 88 + i * 34)
    })
    // code
    g.font = '500 26px "IBM Plex Mono", ui-monospace, monospace'
    let lastX = 0
    let lastY = 0
    this.lines.forEach(([indent, col, text], i) => {
      const y = 96 + i * 42
      g.fillStyle = '#3d4450'
      g.fillText(String(i + 1).padStart(2, ' '), 210, y)
      g.fillStyle = col
      const x = 270 + indent * 36
      g.fillText(text, x, y)
      lastX = x + g.measureText(text).width
      lastY = y
    })
    if (this.cursorOn) {
      g.fillStyle = '#d6f06b'
      g.fillRect(lastX + 4, lastY - 24, 14, 30)
    }
    // status bar
    g.fillStyle = '#d6f06b'
    g.fillRect(0, h - 30, w, 30)
    g.fillStyle = '#1d2117'
    g.font = '500 17px "IBM Plex Mono", ui-monospace, monospace'
    g.fillText('● main    desk.ts    TypeScript', 16, h - 9)
    this.texture.needsUpdate = true
  }
}

/* -------------------------------------------------------------- objects */

type DeskItem = {
  id: Pickable
  group: THREE.Group
  baseY: number
  /** point the label floats above and the camera looks at */
  anchor: THREE.Vector3
  /** how far the camera sits from the object when it opens */
  dist: number
  lift: number
}

function shadowed<T extends THREE.Object3D>(o: T) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })
  return o
}

function buildDesk(scene: THREE.Scene) {
  const wood = woodTexture()
  const top = new THREE.Mesh(new THREE.BoxGeometry(DESK_W, 0.06, DESK_D), std('#ffffff', 0.55, 0, { map: wood }))
  top.position.y = -0.03
  const metal = std('#2b2b2b', 0.45, 0.6)
  const legs = new THREE.Group()
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, LEG_H, 0.06), metal)
      leg.position.set(sx * (DESK_W / 2 - 0.12), -0.06 - LEG_H / 2, sz * (DESK_D / 2 - 0.12))
      legs.add(leg)
    }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(DESK_W - 0.24, 0.05, 0.03), metal)
  rail.position.set(0, -0.6, -(DESK_D / 2 - 0.12))
  legs.add(rail)
  scene.add(shadowed(top), shadowed(legs))

  // the room: floor, back wall and a skirting board
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std('#b9ab8e', 0.9))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.06 - LEG_H
  floor.receiveShadow = true
  // with the window's opening cut out; it casts shadows so light from outside only comes in through the glass
  const wall = new THREE.Mesh(wallGeometry(30, 12, 4), std('#e7e1cf', 0.95))
  wall.position.set(0, 4, WALL_Z)
  wall.receiveShadow = true
  wall.castShadow = true
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 0.02), std('#d6ceb8', 0.8))
  skirting.position.set(0, floor.position.y + 0.06, -1.24)
  scene.add(floor, wall, skirting)

  // two framed paintings on the wall, one either side of the laptop (both Caravaggio, public domain)
  for (const p of PAINTINGS) scene.add(hangPainting(p))
}

/** the paintings on the wall: image, its size in pixels, and where it hangs (x, y of its centre) */
const PAINTINGS = [
  { file: 'art/narcissus.webp', px: [1057, 1280], at: [-0.72, 0.74] },
  { file: 'art/boy-bitten-by-a-lizard.webp', px: [988, 1280], at: [0.72, 0.74] },
] as const
/** every painting is this tall, so the two frames match */
const ART_H = 0.9

/** a painting in the desk's frame: a dark moulding, a cream mat, and the picture */
function hangPainting({ file, px, at }: (typeof PAINTINGS)[number]) {
  const w = ART_H * (px[0] / px[1])
  const art = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, ART_H + 0.18, 0.035), std('#1d2117', 0.45))
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, ART_H + 0.1), std('#f6f2e6', 0.9))
  mat.position.z = 0.0181
  const canvasMat = std('#2a1d14', 0.75) // dark until the picture arrives
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(w, ART_H), canvasMat)
  painting.position.z = 0.0185
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${file}`, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    canvasMat.map = tex
    canvasMat.color.set(0xffffff)
    canvasMat.needsUpdate = true
  })
  art.add(frame, mat, painting)
  art.position.set(at[0], at[1], -1.23)
  return shadowed(art)
}

function buildMonitor(screen: ScreenCanvas) {
  const g = new THREE.Group()
  const shell = std('#1f1f22', 0.4, 0.3)
  const alu = std('#b8bcc2', 0.3, 0.8)

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.018, 0.22), alu)
  base.position.set(0, 0.009, -0.05)
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.025), alu)
  neck.position.set(0, 0.23, -0.1)
  neck.rotation.x = -0.08
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.68, 0.035), shell)
  body.position.set(0, 0.64, -0.07)
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.62),
    new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }),
  )
  face.position.set(0, 0.64, -0.052)

  // keyboard + mouse belong to the workstation
  const kb = new THREE.Group()
  const kbBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.022, 0.24), alu)
  kbBase.position.y = 0.011
  kb.add(kbBase)
  const keyGeo = new THREE.BoxGeometry(0.04, 0.012, 0.04)
  const keyMat = std('#2a2a2d', 0.7)
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, 14 * 5)
  const m = new THREE.Matrix4()
  let n = 0
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 14; c++) {
      m.makeTranslation(-0.3 + c * 0.0465, 0.026, -0.085 + r * 0.045)
      keys.setMatrixAt(n++, m)
    }
  kb.add(keys)
  kb.position.set(0, 0, 0.36)
  kb.rotation.y = 0.03

  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), std('#e9e6df', 0.35))
  mouse.scale.set(0.65, 0.35, 1)
  mouse.position.set(0.52, 0.016, 0.38)

  g.add(base, neck, body, face, kb, mouse)
  g.position.set(0, 0, -0.3)
  return shadowed(g)
}

function buildCoffee(puff: THREE.Texture) {
  const g = new THREE.Group()
  const ceramic = std('#f3efe6', 0.25, 0, { envMapIntensity: 0.8 })

  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.062, 0),
    new THREE.Vector2(0.068, 0.006),
    new THREE.Vector2(0.072, 0.15),
    new THREE.Vector2(0.074, 0.158),
    new THREE.Vector2(0.066, 0.158),
    new THREE.Vector2(0.063, 0.015),
    new THREE.Vector2(0, 0.015),
  ]
  const mug = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), ceramic)
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.066, 40), std('#3b2314', 0.15))
  coffee.rotation.x = -Math.PI / 2
  coffee.position.y = 0.128
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 12, 28, Math.PI), ceramic)
  handle.rotation.z = -Math.PI / 2
  handle.position.set(0.068, 0.08, 0)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0715, 0.0705, 0.03, 48, 1, true), std('#d6f06b', 0.35))
  band.position.y = 0.1

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.012, 48), ceramic)
  saucer.position.y = 0.006
  const cup = new THREE.Group()
  cup.add(mug, coffee, handle, band)
  cup.position.y = 0.012
  cup.rotation.y = -0.6
  g.add(saucer, cup)
  shadowed(g)

  // steam: a few puffs that rise, spread and fade in a loop
  const steam = new THREE.Group()
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }),
    )
    s.userData.offset = i / 7
    steam.add(s)
  }
  steam.position.y = 0.15
  g.add(steam)
  g.userData.steam = steam

  g.position.set(0.98, 0, 0.18)
  return g
}

function buildBooks() {
  const g = new THREE.Group()
  const pages = std('#efe7d2', 0.9)
  const specs: [string, number, number, number, number][] = [
    // colour, width, thickness, depth, yaw
    ['#2f4a3a', 0.36, 0.055, 0.26, 0.05],
    ['#8c2f24', 0.33, 0.045, 0.24, -0.12],
    ['#23304f', 0.31, 0.06, 0.22, 0.2],
    ['#d9b44a', 0.27, 0.035, 0.2, -0.04],
  ]
  let y = 0
  for (const [col, w, t, d, yaw] of specs) {
    const book = new THREE.Group()
    const cover = std(col, 0.7)
    const board = 0.006
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, board, d), cover)
    back.position.y = board / 2
    const front = back.clone()
    front.position.y = t - board / 2
    const spine = new THREE.Mesh(new THREE.BoxGeometry(board * 1.5, t, d), cover)
    spine.position.set(-w / 2 + board * 0.75, t / 2, 0)
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.012, t - board * 2, d - 0.01), pages)
    block.position.set(0.004, t / 2, 0)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(board * 1.6, t * 0.35, d * 0.9), std('#e8d38a', 0.3, 0.7))
    stripe.position.set(-w / 2 + board * 0.7, t / 2, 0)
    book.add(back, front, spine, block, stripe)
    book.position.y = y
    book.rotation.y = yaw + Math.PI / 2
    y += t
    g.add(book)
  }
  // a pencil resting on top
  const pencil = new THREE.Group()
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 6), std('#e0a526', 0.6))
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), std('#e7c9a0', 0.8))
  tip.position.y = 0.095
  pencil.add(wood, tip)
  pencil.rotation.set(Math.PI / 2, 0, 0.9)
  pencil.position.set(0.02, y + 0.006, 0.02)
  g.add(pencil)
  g.position.set(-1.05, 0, 0.05)
  g.rotation.y = 0.25
  return shadowed(g)
}

type PigeonRig = { head: THREE.Group; wings: THREE.Mesh[]; body: THREE.Group }

/**
 * A glTF loader that decodes textures with an <img> element. Its default decoder
 * fetch()es a blob: URL, which hosts with a strict Content-Security-Policy refuse,
 * and the models then show up with no colour.
 */
function gltfLoader() {
  return new GLTFLoader().register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager).setCrossOrigin('anonymous')
    return { name: 'desk_img_element_textures' }
  })
}

/** the pigeon model in public/models: a rigged bird with its own idle animation */
const PIGEON_MODEL = `${import.meta.env.BASE_URL}models/pigeon.glb`
/** the model is 0.63 tall; this brings it to the size of the other things on the desk */
const PIGEON_SCALE = 0.5

/** a MacBook Air (CC BY 4.0, rtql8d on Sketchfab — credited on the page) in public/models */
const LAPTOP_MODEL = `${import.meta.env.BASE_URL}models/laptop.glb`
/** the model is 3.04 wide; this makes it about 0.76 across the desk */
const LAPTOP_SCALE = 0.25

/** the laptop, with the code-editor screen laid over its display */
async function loadLaptopModel(screen: ScreenCanvas) {
  const gltf = await gltfLoader().loadAsync(LAPTOP_MODEL)
  const model = gltf.scene
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
  })
  // the display, just in front of the glass (model units: the lid stands at z = -1.08)
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(2.86, 1.86),
    new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }),
  )
  face.position.set(0, 1.04, -1.074)
  model.add(face)
  model.scale.setScalar(LAPTOP_SCALE)
  model.position.y = 0.136 * LAPTOP_SCALE // its feet sit below the origin
  const g = new THREE.Group()
  g.add(model)
  return g
}

/** a takeaway cup (CC BY 4.0, Lasse Harm on Sketchfab — credited on the page) in public/models */
const COFFEE_MODEL = `${import.meta.env.BASE_URL}models/coffee.glb`
/** the model is 3.72 tall, standing on y = -1; this makes it about 0.2 tall */
const COFFEE_SCALE = 0.055

async function loadCoffeeModel() {
  const gltf = await gltfLoader().loadAsync(COFFEE_MODEL)
  const model = gltf.scene
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
  })
  model.scale.setScalar(COFFEE_SCALE)
  model.position.y = 1 * COFFEE_SCALE // its base sits at y = -1
  model.rotation.y = -0.4
  return model
}

/** a salt rock lamp (CC BY 4.0, Meerschaum Digital on Sketchfab — credited on the page) in public/models */
const LAMP_MODEL = `${import.meta.env.BASE_URL}models/lamp.glb`
/** the model is 0.32 tall; this makes it about 0.48 */
const LAMP_SCALE = 1.5
const LAMP_GLOW = 1.9

/** the salt lamp, lit from inside by a warm point light */
async function loadLampModel() {
  const gltf = await gltfLoader().loadAsync(LAMP_MODEL)
  const model = gltf.scene
  let rock: THREE.MeshStandardMaterial | undefined
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat.isMeshStandardMaterial) {
      mat.emissive.set('#ff7f30') // the texture carries the glow's pattern; this makes it amber
      mat.emissiveIntensity = LAMP_GLOW
      rock = mat
    }
  })
  if (!rock) throw new Error('The lamp model has no glowing material')
  model.scale.setScalar(LAMP_SCALE)
  const light = new THREE.PointLight('#ff9a52', 1.6, 2.4, 1.5)
  light.position.y = 0.2 // inside the rock
  const g = new THREE.Group()
  g.add(model, light)
  g.userData.rig = { light, bulb: rock, glow: LAMP_GLOW, on: true } satisfies LampRig
  return g
}

/** a potted plant (CC BY 4.0, Teague McGinn on Sketchfab — credited on the page) in public/models */
const PLANT_MODEL = `${import.meta.env.BASE_URL}models/plant.glb`
/** the model is 34.6 tall (centimetres); this makes it about 0.55 */
const PLANT_SCALE = 0.016

async function loadPlantModel() {
  const gltf = await gltfLoader().loadAsync(PLANT_MODEL)
  const model = shadowed(gltf.scene)
  model.scale.setScalar(PLANT_SCALE)
  model.rotation.y = 0.6
  return model
}

/** a floor lamp (CC BY 4.0, Jack John on Sketchfab — credited on the page) in public/models */
const FLOOR_LAMP_MODEL = `${import.meta.env.BASE_URL}models/floor-lamp.glb`
/** the model is 1.3 tall; this makes it about 1.8, standing well above the desk */
const FLOOR_LAMP_SCALE = 1.4
/** on the floor, just past the desk's left end, its head leaning over the desk */
const FLOOR_LAMP_POS = new THREE.Vector3(-1.95, -0.06 - LEG_H, -0.55)

/** what the time of day turns on and off: its light and the glow of its bulb */
type FloorLampRig = { spot: THREE.SpotLight; fill: THREE.PointLight; bulb: THREE.MeshStandardMaterial[] }

async function loadFloorLamp() {
  const gltf = await gltfLoader().loadAsync(FLOOR_LAMP_MODEL)
  const model = shadowed(gltf.scene)
  const bulb: THREE.MeshStandardMaterial[] = []
  let head: THREE.Box3 | null = null
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.MeshStandardMaterial
    // the bulb's glowing disc under the shade carries the model's own emissive colour
    if (mat.emissive && mat.emissive.getHex() !== 0) {
      mat.emissive.set('#ffd29a')
      mat.toneMapped = false
      bulb.push(mat)
      m.castShadow = false
      head = new THREE.Box3().setFromObject(m)
    } else if (mat.color.getHex() === 0) {
      mat.color.set('#1c1b1a') // pure black reads as a hole; a near-black catches the light
    }
  })
  const g = new THREE.Group()
  g.add(model)
  // the light hangs just under the shade, pointing down and out over the floor and desk
  const at = head ? (head as THREE.Box3).getCenter(new THREE.Vector3()) : new THREE.Vector3(-0.2, 1.0, 0.2)
  at.y -= 0.03
  const spot = new THREE.SpotLight('#ffcf8f', 0, 6, 1.05, 0.8, 1.6)
  spot.position.copy(at)
  spot.target.position.set(at.x, 0, at.z + 0.35)
  const fill = new THREE.PointLight('#ffc27a', 0, 3.2, 1.6)
  fill.position.copy(at)
  g.add(spot, spot.target, fill)
  g.scale.setScalar(FLOOR_LAMP_SCALE)
  g.rotation.y = Math.PI / 2 // its head leans towards +Z in the model; turn it over the desk (+X)
  g.position.copy(FLOOR_LAMP_POS)
  g.userData.rig = { spot, fill, bulb } satisfies FloorLampRig
  return g
}

/** four upright books with their cover textures (public/models/books.glb) */
const BOOKS_MODEL = `${import.meta.env.BASE_URL}models/books.glb`
/** height on the desk; the model is scaled to it, whatever units it was exported in */
const BOOKS_HEIGHT = 0.42

async function loadBooksModel() {
  const gltf = await gltfLoader().loadAsync(BOOKS_MODEL)
  const model = shadowed(gltf.scene)
  // centre it over its spot with its base on the desk
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const s = BOOKS_HEIGHT / size.y
  model.scale.multiplyScalar(s)
  model.position.set(-centre.x * s, -box.min.y * s, -centre.z * s)
  const g = new THREE.Group()
  g.add(model)
  return g
}

/** a KRK Rokit RP8 G4 (Sketchfab Standard licence, jeff.kershaw — credited on the page) in public/models */
const SPEAKER_MODEL = `${import.meta.env.BASE_URL}models/speaker.glb`
/** the model is life size (0.45 tall); the desk is drawn bigger than life, so it is too */
const SPEAKER_SCALE = 1.3
/** where the pair stands: either side of the laptop, towards the back of the desk */
const SPEAKER_X = 0.76
const SPEAKER_Z = -0.42
/** turned in a little towards the middle of the desk */
const SPEAKER_TOE = 0.22

/** the woofer cones, which pump while the music plays */
type SpeakerRig = { cones: { mesh: THREE.Object3D; rest: THREE.Vector3; out: THREE.Vector3 }[] }

/** a stand-in speaker, until the model loads (or if it can't) */
function buildSpeaker(side: number) {
  const g = new THREE.Group()
  const h = 0.45 * SPEAKER_SCALE
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3 * SPEAKER_SCALE, h, 0.35 * SPEAKER_SCALE), std('#1b1b1b', 0.5))
  box.position.y = h / 2
  const cone = new THREE.Mesh(new THREE.CircleGeometry(0.1 * SPEAKER_SCALE, 32), std('#e8c21c', 0.4))
  cone.position.set(0, h * 0.35, 0.175 * SPEAKER_SCALE + 0.002)
  g.add(box, cone)
  g.position.set(side * SPEAKER_X, 0, SPEAKER_Z)
  g.rotation.y = -side * SPEAKER_TOE
  g.userData.rig = { cones: [] } satisfies SpeakerRig
  return shadowed(g)
}

async function loadSpeakerModel() {
  const gltf = await gltfLoader().loadAsync(SPEAKER_MODEL)
  const model = shadowed(gltf.scene)
  model.updateMatrixWorld(true)
  // the cones' rest positions, and which way is "out" for each (the model faces +Z)
  const cones: SpeakerRig['cones'] = []
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !/cone/.test((m.material as THREE.Material).name) || !m.parent) return
    const toParent = new THREE.Matrix4().copy(m.parent.matrixWorld).invert()
    const out = new THREE.Vector3(0, 0, 1).transformDirection(toParent)
    const scale = new THREE.Vector3().setFromMatrixScale(toParent)
    out.multiplyScalar(0.005 * scale.x)
    cones.push({ mesh: m, rest: m.position.clone(), out })
  })
  const box = new THREE.Box3().setFromObject(model)
  model.position.y = -box.min.y // stand it on the desk
  const g = new THREE.Group()
  g.add(model)
  g.scale.setScalar(SPEAKER_SCALE)
  g.userData.rig = { cones } satisfies SpeakerRig
  return g
}

type ModelPigeonRig = {
  body: THREE.Group
  mixer: THREE.AnimationMixer
  /** base of the neck: turned towards the camera on hover */
  neck: THREE.Object3D | undefined
  yaw: number
}

async function loadPigeonModel(): Promise<ModelPigeonRig> {
  const gltf = await gltfLoader().loadAsync(PIGEON_MODEL)
  const model = gltf.scene
  model.scale.setScalar(PIGEON_SCALE)
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    // the export lights the bird with its own colours; let the desk's lamps light it instead
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const std = mat as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial) continue
      std.emissive.set(0x000000)
      std.emissiveMap = null
      std.side = THREE.FrontSide
      std.needsUpdate = true
    }
  })
  const body = new THREE.Group()
  body.add(model)
  const mixer = new THREE.AnimationMixer(model)
  for (const clip of gltf.animations) mixer.clipAction(clip).play()
  return { body, mixer, neck: model.getObjectByName('Chicken_Neck_01_01SHJnt'), yaw: 0 }
}

function buildPigeon() {
  const g = new THREE.Group()
  const grey = std('#8d95a3', 0.8)
  const darkGrey = std('#5f6674', 0.8)
  const neckMat = new THREE.MeshPhysicalMaterial({
    color: '#6f8a7f',
    roughness: 0.4,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [250, 700],
  })
  const black = std('#16161a', 0.4)
  const pink = std('#c9737a', 0.6)

  const body = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), grey)
  torso.scale.set(0.085, 0.075, 0.13)
  torso.position.set(0, 0.115, 0)
  torso.rotation.x = 0.25
  const breast = new THREE.Mesh(new THREE.SphereGeometry(0.058, 28, 20), neckMat)
  breast.position.set(0, 0.155, 0.065)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.11), darkGrey)
  tail.position.set(0, 0.1, -0.15)
  tail.rotation.x = -0.35
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.077, 0.013, 0.025), black)
  tailTip.position.set(0, 0.083, -0.2)
  tailTip.rotation.x = -0.35

  const wings: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), grey)
    wing.scale.set(0.022, 0.055, 0.12)
    wing.position.set(s * 0.072, 0.125, -0.025)
    wing.rotation.x = 0.3
    // two dark wing bars, the classic rock-dove marking
    for (const z of [-0.2, 0.25]) {
      const bar = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), black)
      bar.scale.set(0.25, 0.25, 0.08)
      bar.position.set(s * 0.8, 0.1, z)
      wing.add(bar)
    }
    wing.userData.side = s
    wings.push(wing)
  }

  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), pink)
    leg.position.set(s * 0.028, 0.03, 0.02)
    body.add(leg)
    for (const yaw of [-0.5, 0, 0.5]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.035, 6), pink)
      toe.rotation.set(Math.PI / 2, 0, yaw)
      toe.position.set(s * 0.028 - Math.sin(yaw) * 0.015, 0.003, 0.02 + Math.cos(yaw) * 0.015)
      body.add(toe)
    }
  }
  body.add(torso, breast, tail, tailTip, ...wings)

  // head on a pivot at the base of the neck, so it can bob and peck
  const head = new THREE.Group()
  head.position.set(0, 0.17, 0.07)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.07, 20), neckMat)
  neck.position.set(0, 0.03, 0.01)
  neck.rotation.x = 0.35
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.043, 28, 20), grey)
  skull.position.set(0, 0.075, 0.03)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.04, 12), std('#2a2528', 0.5))
  beak.rotation.x = Math.PI / 2 + 0.25
  beak.position.set(0, 0.066, 0.086)
  const cere = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), std('#f2eee8', 0.8))
  cere.scale.set(1, 0.7, 1.2)
  cere.position.set(0, 0.075, 0.07)
  head.add(neck, skull, beak, cere)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), std('#e3781f', 0.2))
    eye.position.set(s * 0.033, 0.085, 0.052)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), black)
    pupil.position.set(s * 0.006, 0, 0.006)
    eye.add(pupil)
    head.add(eye)
  }
  body.add(head)
  g.add(body)
  g.position.set(-0.52, 0, 0.42)
  g.rotation.y = 0.7
  g.userData.rig = { head, wings, body } satisfies PigeonRig
  return shadowed(g)
}

/** what the lamp switch turns on and off: a light, and the glow of the material it shines through */
type LampRig = { light: THREE.Light; bulb: THREE.MeshStandardMaterial; glow: number; on: boolean }

function buildLamp() {
  const g = new THREE.Group()
  const paint = std('#1d2117', 0.45, 0.3)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.025, 40), paint)
  base.position.y = 0.0125
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 12), paint)
  lower.position.set(0, 0.25, 0.06)
  lower.rotation.x = 0.25
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), paint)
  joint.position.set(0, 0.49, 0.12)
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 12), paint)
  upper.position.set(-0.12, 0.56, 0.13)
  upper.rotation.z = Math.PI / 2 - 0.35
  const head = new THREE.Group()
  head.position.set(-0.32, 0.62, 0.14)
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.11, 0.14, 40, 1, true),
    std('#d6f06b', 0.5, 0, { side: THREE.DoubleSide }),
  )
  const bulbMat = std('#fff7e0', 0.3, 0, { emissive: '#ffd89a', emissiveIntensity: 2.2 })
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 14), bulbMat)
  bulb.position.y = -0.03
  head.add(shade, bulb)
  head.rotation.z = -0.35
  g.add(base, lower, joint, upper, head)
  shadowed(g)
  bulb.castShadow = false

  const light = new THREE.SpotLight('#ffcf8a', 5, 3, 0.75, 0.6, 1.4)
  light.position.set(-0.32, 0.6, 0.14)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.bias = -0.0004
  light.shadow.radius = 6
  const target = new THREE.Object3D()
  target.position.set(-0.75, 0, 0.3)
  g.add(light, target)
  light.target = target

  g.position.set(1.25, 0, -0.45)
  g.rotation.y = -0.35
  g.userData.rig = { light, bulb: bulbMat, glow: 2.2, on: true } satisfies LampRig
  return g
}

/** a small plant for the far corner, purely decoration */
function buildPlant() {
  const g = new THREE.Group()
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.13, 32), std('#c46b45', 0.8))
  pot.position.y = 0.065
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), std('#3a2a1e', 1))
  soil.rotation.x = -Math.PI / 2
  soil.position.y = 0.12
  g.add(pot, soil)
  const leaf = std('#4f7a3a', 0.6, 0, { side: THREE.DoubleSide })
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), leaf)
    l.scale.set(0.028, 0.004, 0.09)
    const a = (i / 9) * Math.PI * 2
    const pivot = new THREE.Group()
    pivot.position.y = 0.12
    pivot.rotation.set(0, a, 0)
    l.position.set(0, 0.06 + (i % 3) * 0.02, 0.06)
    l.rotation.x = -0.7 - (i % 3) * 0.2
    pivot.add(l)
    g.add(pivot)
  }
  g.position.set(-1.35, 0, -0.5)
  return shadowed(g)
}

/* ---------------------------------------------------------------- scene */

export class DeskScene {
  onHover: (id: Pickable | null) => void = () => {}
  onPick: (id: Pickable) => void = () => {}
  /** a click on the desk around an open object's page: close it */
  onDismiss: () => void = () => {}
  reduced = false

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private outline: OutlinePass
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60)
  private controls: OrbitControls
  private items: DeskItem[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pointerInside = false
  private hovered: DeskItem | null = null
  /** set from outside (the object list) — wins over the pointer */
  private forced: Pickable | null = null
  private focused: DeskItem | null = null
  private screen = new ScreenCanvas()
  private timer = new THREE.Timer()
  private raf = 0
  private blinkTimer = 0
  private down: { x: number; y: number; t: number } | null = null
  private label: HTMLElement | null
  private width = 1
  private height = 1
  private tween: {
    fromPos: THREE.Vector3
    fromTarget: THREE.Vector3
    fromShift: THREE.Vector2
    toPos: THREE.Vector3
    toTarget: THREE.Vector3
    toShift: THREE.Vector2
    t: number
    dur: number
    done?: () => void
  } | null = null
  private hop = 0
  /** view offset as a fraction of the screen (the page covers the rest) */
  private shift = new THREE.Vector2()
  private homeScale = 1
  /** what the open page covers, kept so a late-loading model can be reframed */
  private cover: Cover = { x: 0, y: 0 }
  private disposers: (() => void)[] = []
  private disposed = false

  constructor(
    host: HTMLElement,
    label: HTMLElement | null,
  ) {
    this.label = label
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    this.renderer = renderer
    host.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = env
    this.scene.environmentIntensity = 0.45
    this.scene.background = new THREE.Color('#e7e1cf')
    this.scene.fog = new THREE.Fog('#e7e1cf', 6, 14)

    this.camera.position.copy(HOME_POS)
    this.controls = new OrbitControls(this.camera, renderer.domElement)
    this.controls.target.copy(HOME_TARGET)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 5
    this.controls.minPolarAngle = 0.35
    this.controls.maxPolarAngle = 1.35
    this.controls.minAzimuthAngle = -1.0
    this.controls.maxAzimuthAngle = 1.0
    this.controls.rotateSpeed = 0.6
    this.controls.update()

    this.lights()
    buildDesk(this.scene)
    // the window is above the home view; zoomed out, the moon sits in its upper panes
    this.window = new DeskWindow(this.scene, new THREE.Vector3(0.35, 1.5, 4.2))
    this.window.load(gltfLoader()).catch((err) => console.warn('The window model failed to load; the opening stays bare.', err))
    const puff = puffTexture()
    this.add('laptop', buildMonitor(this.screen), new THREE.Vector3(0, 0.98, -0.3), 1.9, 0.012)
    this.add('coffee', buildCoffee(puff), new THREE.Vector3(0.98, 0.26, 0.18), 0.85, 0.03)
    this.add('books', buildBooks(), new THREE.Vector3(-1.05, 0.27, 0.05), 1.0, 0.025)
    this.add('pigeon', buildPigeon(), new THREE.Vector3(-0.52, 0.32, 0.42), 0.95, 0)
    this.add('lamp', buildLamp(), new THREE.Vector3(1.1, 0.82, -0.35), 1.2, 0.01)
    for (const side of [-1, 1]) {
      const top = 0.45 * SPEAKER_SCALE
      this.add('speakers', buildSpeaker(side), new THREE.Vector3(side * SPEAKER_X, top * 0.8, SPEAKER_Z), 1.2, 0.012)
    }
    const plant = buildPlant()
    this.scene.add(plant)
    // swap in the 3D models once every object is on the desk
    this.usePigeonModel()
    this.useLaptopModel()
    this.useCoffeeModel()
    this.useLampModel()
    this.useSpeakerModels()
    this.useBooksModel()
    this.usePlantModel(plant)
    loadFloorLamp()
      .then((lamp) => {
        if (this.disposed) return
        this.scene.add(lamp)
        this.floorLamp = lamp.userData.rig as FloorLampRig
        this.lightCheck = 0 // switch it on now if it's already evening
      })
      .catch((err) => console.warn('The floor lamp model failed to load; the corner stays dark.', err))

    // hover outline, rendered into a multisampled target so edges stay smooth
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.outline = new OutlinePass(new THREE.Vector2(1, 1), this.scene, this.camera)
    this.outline.edgeStrength = 4
    this.outline.edgeThickness = 1.5
    this.outline.edgeGlow = 0.4
    this.outline.pulsePeriod = 2.4
    this.outline.visibleEdgeColor.set('#d6f06b')
    this.outline.hiddenEdgeColor.set('#6f7d2a')
    this.composer.addPass(this.outline)
    this.composer.addPass(new OutputPass())

    this.listen()
    this.disposers.push(() => {
      env.dispose()
      this.window.dispose()
      puff.dispose()
      rt.dispose()
    })
    this.blinkTimer = window.setInterval(() => this.screen.blink(), 530)
    this.loop()
  }

  private window!: DeskWindow
  /** the floor lamp, switched by the time of day once its model is in */
  private floorLamp: FloorLampRig | null = null
  private hemi!: THREE.HemisphereLight
  private sun!: THREE.DirectionalLight
  /** when the light was last matched to the clock */
  private lightCheck = 0
  /** dark enough that the page's text over the desk should be light */
  private darkListener: (dark: boolean) => void = () => {}
  private dark: boolean | null = null
  set onDarkChange(fn: (dark: boolean) => void) {
    this.darkListener = fn
    if (this.dark !== null) fn(this.dark) // the light was set before anyone was listening
  }

  /** light the room for the visitor's time of day: bright by day, warm at sunset, dim at night */
  private daylight() {
    const l = lightAt(currentHour())
    this.sun.intensity = l.sun
    this.sun.color.set(l.sunColor)
    this.sun.position.set(...l.sunPos)
    this.hemi.intensity = l.hemi
    this.hemi.color.set(l.sky)
    this.hemi.groundColor.set(l.ground)
    this.scene.environmentIntensity = l.env
    ;(this.scene.background as THREE.Color).set(l.air)
    this.scene.fog!.color.set(l.air)
    this.renderer.toneMappingExposure = l.exposure
    this.window.apply(l)
    // the floor lamp comes on as the daylight fades, and goes off as it returns
    if (this.floorLamp) {
      const on = THREE.MathUtils.clamp((0.5 - l.hemi) / 0.25, 0, 1)
      this.floorLamp.spot.intensity = 7 * on
      this.floorLamp.fill.intensity = 1.4 * on
      this.floorLamp.bulb.forEach((m) => (m.emissiveIntensity = 0.15 + 2.2 * on))
    }
    const dark = isDark(l)
    if (dark !== this.dark) {
      this.dark = dark
      this.darkListener(dark)
    }
  }

  private lights() {
    const hemi = new THREE.HemisphereLight('#fff6e6', '#8a7a5c', 0.9)
    const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
    this.hemi = hemi
    this.sun = sun
    sun.position.set(-2.5, 4, 2.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -2.4
    sun.shadow.camera.right = 2.4
    sun.shadow.camera.top = 2.4
    sun.shadow.camera.bottom = -2.4
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 12
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 4
    this.scene.add(hemi, sun)
  }

  private add(id: Pickable, group: THREE.Group, anchor: THREE.Vector3, dist: number, lift: number) {
    group.userData.pick = id
    this.scene.add(group)
    this.items.push({ id, group, baseY: group.position.y, anchor, dist, lift })
  }

  /* --------------------------------------------------------- pointer */

  private listen() {
    const el = this.renderer.domElement
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      this.pointerInside = true
    }
    const leave = () => {
      this.pointerInside = false
    }
    const down = (e: PointerEvent) => {
      move(e)
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    }
    const up = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return // a drag
      if (this.focused) {
        this.onDismiss() // clicked off the open page (even while the camera is still flying in)
        return
      }
      if (this.tween) return
      move(e)
      const hit = this.pick()
      if (hit) this.onPick(hit.id)
      if (e.pointerType !== 'mouse') this.pointerInside = false // touch has no hover afterwards
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    this.disposers.push(() => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
    })
  }

  private pick(): DeskItem | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.items.map((i) => i.group),
      true,
    )
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      if ((o as THREE.Sprite).isSprite) continue // steam is not solid
      while (o && !o.userData.pick) o = o.parent
      if (o && o.visible) return this.items.find((i) => i.group === o) ?? null
    }
    return null
  }

  /** highlight an object from outside the canvas (e.g. the keyboard-accessible list) */
  highlight(id: Pickable | null) {
    this.forced = id
  }

  /* ----------------------------------------------------------- camera */

  /**
   * Fly to an object. `side` says where the page covers the screen, so the
   * object is framed in the part that stays visible.
   */
  focus(id: DeskId, cover: Cover, done?: () => void) {
    const item = this.items.find((i) => i.id === id)
    if (!item) return
    this.cover = cover
    this.focused = item
    this.controls.enabled = false
    const dir = new THREE.Vector3().subVectors(HOME_POS, HOME_TARGET).normalize()
    dir.y = Math.max(dir.y, 0.45)
    dir.normalize()
    // same apparent size whatever the field of view, and far enough back to fit the visible part
    const fovFit = Math.tan(THREE.MathUtils.degToRad(19)) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const visW = (1 - cover.x) * this.camera.aspect
    const visH = 1 - cover.y
    const room = Math.max(1, 1 / visW, 0.6 / visH)
    const target = item.anchor.clone()
    target.y -= item.dist * 0.08
    const pos = target.clone().addScaledVector(dir, item.dist * fovFit * room)
    // move the centre of the picture into the part of the screen the page leaves free
    this.flyTo(pos, target, new THREE.Vector2(cover.x / 2, cover.y / 2), 1.1, done)
  }

  /** back to the view of the whole desk */
  release() {
    this.focused = null
    this.flyTo(this.homePos(), HOME_TARGET.clone(), new THREE.Vector2(), 1.0, () => {
      this.controls.enabled = true
    })
  }

  /** jump straight to a focused view (first load of /desk/<id>) */
  focusNow(id: DeskId, cover: Cover) {
    this.focus(id, cover)
    this.finishTween()
  }

  /** the home view, pulled back on narrow screens so the whole desk fits across */
  private homePos() {
    const offset = new THREE.Vector3().subVectors(HOME_POS, HOME_TARGET)
    return HOME_TARGET.clone().addScaledVector(offset, this.homeScale)
  }

  private setShift(v: THREE.Vector2) {
    this.shift.copy(v)
    if (v.lengthSq() < 1e-6) this.camera.clearViewOffset()
    else this.camera.setViewOffset(this.width, this.height, v.x * this.width, v.y * this.height, this.width, this.height)
  }

  private flyTo(toPos: THREE.Vector3, toTarget: THREE.Vector3, toShift: THREE.Vector2, dur: number, done?: () => void) {
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      fromShift: this.shift.clone(),
      toPos,
      toTarget,
      toShift,
      t: 0,
      dur: this.reduced ? 0 : dur,
      done,
    }
    if (this.reduced) this.finishTween()
  }

  private finishTween() {
    if (!this.tween) return
    this.tween.t = this.tween.dur
    this.stepTween(0)
  }

  private stepTween(dt: number) {
    const tw = this.tween
    if (!tw) return
    tw.t += dt
    const p = tw.dur > 0 ? Math.min(1, tw.t / tw.dur) : 1
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
    this.setShift(new THREE.Vector2().lerpVectors(tw.fromShift, tw.toShift, e))
    this.camera.lookAt(this.controls.target)
    if (p >= 1) {
      this.tween = null
      tw.done?.()
      if (this.controls.enabled) this.controls.update()
    }
  }

  /* ------------------------------------------------------------ loop */

  resize(w: number, h: number) {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    const aspect = this.width / this.height
    this.camera.aspect = aspect
    this.camera.fov = aspect < 0.8 ? 50 : aspect < 1.2 ? 44 : 38
    // phones are narrow: step back until the desk fits across the screen
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect
    const need = 1.45 / halfW
    this.homeScale = Math.max(1, need / HOME_POS.distanceTo(HOME_TARGET))
    this.controls.maxDistance = 5 * this.homeScale
    if (!this.focused && !this.tween) {
      this.camera.position.copy(this.homePos())
      this.controls.target.copy(HOME_TARGET)
      this.controls.update()
    }
    this.setShift(this.shift)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    this.composer.setSize(this.width, this.height)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
  }

  /** the lamp is a switch, not a page */
  toggleLamp() {
    const lamp = this.items.find((i) => i.id === 'lamp')
    if (!lamp) return
    const rig = lamp.group.userData.rig as LampRig
    rig.on = !rig.on
    rig.light.visible = rig.on
    rig.bulb.emissiveIntensity = rig.on ? rig.glow : 0
  }

  /** the speakers' cones pump while the music plays */
  private music = false
  setMusicPlaying(on: boolean) {
    this.music = on
  }

  private animateSpeakers(t: number) {
    const beat = this.music && !this.reduced ? Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 6) : 0 // 120 bpm
    for (const item of this.items) {
      if (item.id !== 'speakers') continue
      for (const c of (item.group.userData.rig as SpeakerRig).cones) c.mesh.position.copy(c.rest).addScaledVector(c.out, beat)
    }
  }

  /** both speakers load the one model, then each takes a copy */
  private useSpeakerModels() {
    const pair = this.items.filter((i) => i.id === 'speakers')
    pair.forEach((i) => (i.group.visible = false))
    loadSpeakerModel()
      .then((model) => {
        if (this.disposed) return
        pair.forEach((item, n) => {
          for (const old of [...item.group.children]) {
            item.group.remove(old)
            old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
          }
          // the first speaker takes the model itself; the other a copy, with its own cones
          const copy = n === 0 ? model : model.clone(true)
          const cones = (model.userData.rig as SpeakerRig).cones.map((c) => {
            const path: number[] = []
            for (let o: THREE.Object3D = c.mesh; o !== model; o = o.parent!) path.unshift(o.parent!.children.indexOf(o))
            const mesh = path.reduce<THREE.Object3D>((o, k) => o.children[k], copy)
            return { mesh, rest: c.rest.clone(), out: c.out.clone() }
          })
          item.group.add(copy)
          item.group.userData.rig = { cones } satisfies SpeakerRig
        })
      })
      .catch((err) => console.warn('The speaker model failed to load, using the built-in ones.', err))
      .finally(() => pair.forEach((i) => (i.group.visible = true)))
  }

  /**
   * Swap a hand-built object for a model. The object stays hidden while the
   * model loads; if it can't load, the hand-built one is shown instead.
   */
  private useModel<T>(id: Pickable, load: () => Promise<T>, apply: (item: DeskItem, loaded: T) => void) {
    const item = this.items.find((i) => i.id === id)!
    item.group.visible = false
    load()
      .then((loaded) => {
        if (this.disposed) return
        apply(item, loaded)
        // already looking at it (opened straight from /laptop): reframe for the new shape
        if (this.focused === item && item.id !== 'lamp' && item.id !== 'speakers') this.focus(item.id, this.cover)
      })
      .catch((err) => console.warn(`The ${id} model failed to load, using the built-in one.`, err))
      .finally(() => {
        item.group.visible = true
      })
  }

  private usePigeonModel() {
    this.useModel('pigeon', loadPigeonModel, (pigeon, rig) => {
      const old = (pigeon.group.userData.rig as PigeonRig).body
      pigeon.group.remove(old)
      old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      pigeon.group.add(rig.body)
      pigeon.group.userData.model = rig
    })
  }

  /** the plant is decoration, not a page, so it swaps in on its own */
  private usePlantModel(plant: THREE.Group) {
    plant.visible = false
    loadPlantModel()
      .then((model) => {
        if (this.disposed) return
        for (const old of [...plant.children]) {
          plant.remove(old)
          old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
        }
        plant.add(model)
      })
      .catch((err) => console.warn('The plant model failed to load, using the built-in one.', err))
      .finally(() => {
        plant.visible = true
      })
  }

  /** the upright books replace the stack */
  private useBooksModel() {
    this.useModel('books', loadBooksModel, (item, books) => {
      for (const old of [...item.group.children]) {
        item.group.remove(old)
        old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      }
      item.group.add(books)
      item.group.rotation.y = 0.35 // spines turned towards the camera
      item.anchor.set(-1.05, 0.5, 0.05)
    })
  }

  /** the salt lamp replaces the desk lamp; clicking it still switches it on and off */
  private useLampModel() {
    this.useModel('lamp', loadLampModel, (item, lamp) => {
      const was = item.group.userData.rig as LampRig
      for (const old of [...item.group.children]) {
        item.group.remove(old)
        old.traverse((o) => {
          ;(o as THREE.Mesh).geometry?.dispose()
          if ((o as THREE.Light).isLight) (o as THREE.Light).dispose() // frees the spotlight's shadow map
        })
      }
      item.group.add(lamp)
      item.group.rotation.y = 0.4
      const rig = lamp.userData.rig as LampRig
      if (!was.on) {
        // keep the switch where the visitor left it
        rig.on = false
        rig.light.visible = false
        rig.bulb.emissiveIntensity = 0
      }
      item.group.userData.rig = rig
      item.anchor.set(1.25, 0.6, -0.45)
    })
  }

  /** the takeaway cup replaces the mug and saucer; the steam stays and rises from its lid */
  private useCoffeeModel() {
    this.useModel('coffee', loadCoffeeModel, (item, cup) => {
      const steam = item.group.userData.steam as THREE.Group
      for (const old of [...item.group.children]) {
        if (old === steam) continue
        item.group.remove(old)
        old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      }
      item.group.add(cup)
      steam.position.y = 0.2
    })
  }

  /** the laptop model replaces the stand-in monitor, keyboard and mouse */
  private useLaptopModel() {
    this.useModel('laptop', () => loadLaptopModel(this.screen), (item, laptop) => {
      for (const old of [...item.group.children]) {
        item.group.remove(old)
        old.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      }
      laptop.position.z = 0.4 // forward of where the monitor stood, clear of the speakers
      laptop.rotation.y = -0.06
      item.group.add(laptop)
      item.anchor.set(0, 0.42, 0.05)
      item.dist = 1.5
    })
  }

  /** put a picture on the laptop's screen (the stand-in monitor's too) */
  showScreenImage(url: string) {
    this.screen.showImage(url)
  }

  pigeonHop() {
    this.hop = 0.55
  }

  /** stop drawing while something covers the whole desk (a case study page) */
  paused = false

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    this.timer.update()
    if (this.paused) return
    const dt = Math.min(this.timer.getDelta(), 0.05)
    const t = this.timer.getElapsed()

    // the light follows the clock; once a minute is plenty
    if (t - this.lightCheck > 60 || this.lightCheck === 0) {
      this.lightCheck = t || 0.001
      this.daylight()
    }

    if (this.tween) this.stepTween(dt)
    else if (this.controls.enabled) this.controls.update()

    // hover: from the list first, then the pointer (not while a page is open)
    let next: DeskItem | null = null
    if (this.forced) next = this.items.find((i) => i.id === this.forced) ?? null
    else if (this.pointerInside && !this.focused && !this.tween && !this.down) next = this.pick()
    else if (this.down && this.hovered && !this.focused) next = this.hovered
    if (next !== this.hovered) {
      this.hovered = next
      this.outline.selectedObjects = next ? [next.group] : []
      this.renderer.domElement.style.cursor = next ? 'pointer' : ''
      this.onHover(next ? next.id : null)
    }
    if (this.focused) this.outline.selectedObjects = []

    for (const item of this.items) {
      const want = item.baseY + (this.hovered === item && !this.focused ? item.lift : 0)
      item.group.position.y += (want - item.group.position.y) * Math.min(1, dt * 10)
    }

    this.animateCoffee(t)
    this.animateSpeakers(t)
    this.animatePigeon(t, dt)
    this.placeLabel()
    this.composer.render(dt)
  }

  private animateCoffee(t: number) {
    const coffee = this.items.find((i) => i.id === 'coffee')!
    const steam = coffee.group.userData.steam as THREE.Group
    steam.children.forEach((s) => {
      const sprite = s as THREE.Sprite
      const p = ((this.reduced ? 0.4 : t * 0.28) + sprite.userData.offset) % 1
      sprite.position.set(Math.sin(p * 6 + sprite.userData.offset * 9) * 0.02, p * 0.26, Math.cos(p * 5) * 0.01)
      const size = 0.05 + p * 0.1
      sprite.scale.set(size, size, 1)
      ;(sprite.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.35
    })
  }

  private animatePigeon(t: number, dt: number) {
    const pigeon = this.items.find((i) => i.id === 'pigeon')!
    const hovered = this.hovered === pigeon || this.focused === pigeon
    const model = pigeon.group.userData.model as ModelPigeonRig | undefined
    if (model) return this.animateModelPigeon(pigeon, model, hovered, dt)
    const rig = pigeon.group.userData.rig as PigeonRig

    // head: a peck every few seconds, a curious tilt towards the camera when hovered
    let pitch = 0
    let yaw = Math.sin(t * 0.7) * 0.35
    let roll = 0
    let fwd = 0
    if (!this.reduced) {
      const cycle = t % 4.2
      if (cycle < 0.5) pitch = Math.sin((cycle / 0.5) * Math.PI) * 0.9 // peck
      fwd = Math.max(0, Math.sin(t * 7)) * 0.012 * (cycle > 2 && cycle < 3.4 ? 1 : 0) // bob
    }
    if (hovered) {
      const local = rig.head.parent!.worldToLocal(this.camera.position.clone())
      yaw = Math.atan2(local.x, local.z) * 0.8
      yaw = Math.max(-1, Math.min(1, yaw))
      pitch = 0
      roll = Math.sin(t * 2.2) * 0.25
    }
    const k = Math.min(1, dt * 8)
    rig.head.rotation.x += (pitch - rig.head.rotation.x) * k
    rig.head.rotation.y += (yaw - rig.head.rotation.y) * k
    rig.head.rotation.z += (roll - rig.head.rotation.z) * k
    rig.head.position.z = 0.07 + fwd

    // a hop with a flap when clicked
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt)
      const p = 1 - this.hop / 0.55
      rig.body.position.y = Math.sin(p * Math.PI) * 0.09
      const flap = Math.sin(p * Math.PI * 6) * 0.9 * Math.sin(p * Math.PI)
      rig.wings.forEach((w) => (w.rotation.z = -w.userData.side * Math.max(0, flap)))
    } else {
      rig.body.position.y = 0
      const ruffle = hovered && !this.reduced ? Math.max(0, Math.sin(t * 9)) * 0.08 : 0
      rig.wings.forEach((w) => (w.rotation.z = -w.userData.side * ruffle))
    }
  }

  private animateModelPigeon(pigeon: DeskItem, rig: ModelPigeonRig, hovered: boolean, dt: number) {
    if (!this.reduced) rig.mixer.update(dt)

    // a hop when clicked
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt)
      rig.body.position.y = Math.sin((1 - this.hop / 0.55) * Math.PI) * 0.09
    } else rig.body.position.y = 0

    // on hover, turn the neck towards the camera, on top of whatever the animation is doing
    let want = 0
    if (hovered) {
      const local = pigeon.group.worldToLocal(this.camera.position.clone())
      want = Math.max(-1, Math.min(1, Math.atan2(local.x, local.z) * 0.8))
    }
    rig.yaw += (want - rig.yaw) * Math.min(1, dt * 6)
    const neck = rig.neck
    if (!neck?.parent || Math.abs(rig.yaw) < 1e-3) return
    // a turn about the world's up axis, expressed in the neck's own space
    pigeon.group.updateMatrixWorld(true)
    const parentQ = neck.parent.getWorldQuaternion(new THREE.Quaternion())
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rig.yaw)
    neck.quaternion.premultiply(parentQ.clone().invert().multiply(turn).multiply(parentQ))
  }

  private placeLabel() {
    const el = this.label
    if (!el) return
    const item = this.hovered
    if (!item || this.focused) {
      el.style.opacity = '0'
      return
    }
    const p = item.anchor.clone()
    p.y += 0.05
    p.project(this.camera)
    const x = (p.x * 0.5 + 0.5) * this.width
    const y = (-p.y * 0.5 + 0.5) * this.height
    el.style.opacity = '1'
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    const model = this.items.find((i) => i.id === 'pigeon')?.group.userData.model as ModelPigeonRig | undefined
    model?.mixer.stopAllAction()
    clearInterval(this.blinkTimer)
    this.disposers.forEach((d) => d())
    this.timer.dispose()
    this.controls.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
      mats.forEach((mat) => {
        Object.values(mat).forEach((v) => (v as THREE.Texture)?.isTexture && (v as THREE.Texture).dispose())
        mat.dispose()
      })
    })
    this.screen.texture.dispose()
    this.outline.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
