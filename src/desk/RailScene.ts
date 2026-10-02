import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const RAIL_MODEL = `${import.meta.env.BASE_URL}models/clothes-rail.glb`
const TEE_MODEL = `${import.meta.env.BASE_URL}models/tshirt.glb`

/** the top of the rail's rod, in the rail model's units (metres) */
const ROD_Y = 1.566
/** how far apart the shirts hang side-on, and how much room a turned one takes */
const GAP = 0.15
const OPEN = 0.6

/**
 * Part of a flat product photo that becomes the shirt's front panel: by default the
 * torso, without the sleeves (as fractions of the photo). Everything else on the shirt
 * takes the shirt's own colour, sampled from the photo.
 */
export type FrontCrop = { x0: number; x1: number; y0: number; y1: number }
export const DEFAULT_FRONT: FrontCrop = { x0: 0.24, x1: 0.76, y0: 0.0, y1: 1.0 }

/** the shirt's colour: the most common opaque colour along the photo's lower body */
function shirtColour(img: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, 64, 64)
  const counts = new Map<string, { n: number; rgb: number[] }>()
  for (let y = 44; y < 60; y++)
    for (const x of [18, 22, 26, 38, 42, 46]) {
      const [r, gg, b, a] = g.getImageData(x, y, 1, 1).data
      if (a < 200) continue
      const key = [r >> 4, gg >> 4, b >> 4].join()
      const e = counts.get(key) ?? { n: 0, rgb: [0, 0, 0] }
      e.n++
      e.rgb = [e.rgb[0] + r, e.rgb[1] + gg, e.rgb[2] + b]
      counts.set(key, e)
    }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  if (!best) return new THREE.Color('#888888')
  return new THREE.Color().setRGB(best.rgb[0] / best.n / 255, best.rgb[1] / best.n / 255, best.rgb[2] / best.n / 255, THREE.SRGBColorSpace)
}

/** the torso of the photo, on the shirt's colour so cut-out corners don't show */
function frontTexture(img: HTMLImageElement, colour: THREE.Color, FRONT: FrontCrop) {
  const sw = img.naturalWidth * (FRONT.x1 - FRONT.x0)
  const sh = img.naturalHeight * (FRONT.y1 - FRONT.y0)
  const c = document.createElement('canvas')
  c.width = 768
  c.height = Math.round((768 * sh) / sw)
  const g = c.getContext('2d')!
  g.fillStyle = `#${colour.getHexString(THREE.SRGBColorSpace)}`
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, img.naturalWidth * FRONT.x0, img.naturalHeight * FRONT.y0, sw, sh, 0, 0, c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.channel = 1 // our own projected coordinates (uv1), so the model's fabric normals keep theirs
  return t
}

/**
 * Give the front panel coordinates that lay the photo flat across it, as seen
 * from the front (+X). Written to uv1 so the original uv stays for the normal map.
 */
function projectFront(mesh: THREE.Mesh, box: THREE.Box3) {
  const pos = mesh.geometry.attributes.position
  const uv = new Float32Array(pos.count * 2)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    // looking at the front, the shirt's right-hand side (screen right) is -Z
    uv[i * 2] = (box.max.z - v.z) / (box.max.z - box.min.z)
    uv[i * 2 + 1] = (v.y - box.min.y) / (box.max.y - box.min.y)
  }
  mesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2))
}

type Shirt = { pivot: THREE.Group; turn: number; x: number; lift: number }

/** the clothes rail in 3D: shirts hang side-on, and the active one turns to face you */
export class RailScene {
  onHover: (i: number | null) => void = () => {}
  onPick: (i: number) => void = () => {}
  reduced = false

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20)
  private shirts: Shirt[] = []
  private active: number | null = null
  private hovered: number | null = null
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private raf = 0
  private last = 0
  private disposed = false
  private cleanup: (() => void)[] = []
  ready: Promise<void>

  private host: HTMLElement

  constructor(host: HTMLElement, images: { src: string; front?: FrontCrop }[]) {
    this.host = host
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 0.85
    this.renderer = r
    host.appendChild(r.domElement)

    const pmrem = new THREE.PMREMGenerator(r)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = env
    this.scene.environmentIntensity = 0.45
    const key = new THREE.DirectionalLight('#fff4e6', 1.3)
    key.position.set(1.5, 2.5, 2.5)
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b8ad94', 0.8), key)

    this.camera.position.set(0, 1.0, 3.9)
    this.camera.lookAt(0, 0.86, 0)
    this.cleanup.push(() => env.dispose())

    this.listen()
    this.ready = this.build(images)
    this.resize()
  }

  private async build(images: { src: string; front?: FrontCrop }[]) {
    const loader = new GLTFLoader().register((parser) => {
      // decode textures through <img>, which strict Content-Security-Policies allow
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager).setCrossOrigin('anonymous')
      return { name: 'rail_img_element_textures' }
    })
    const [rail, tee, photos] = await Promise.all([
      loader.loadAsync(RAIL_MODEL),
      loader.loadAsync(TEE_MODEL),
      Promise.all(
        images.map(
          ({ src }) =>
            new Promise<HTMLImageElement>((res, rej) => {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.onload = () => res(img)
              img.onerror = rej
              img.src = src
            }),
        ),
      ),
    ])
    if (this.disposed) return
    this.scene.add(rail.scene)

    // the shirt model, recentred so its hanger's hook is the origin
    const template = tee.scene
    template.updateMatrixWorld(true)
    let hook = new THREE.Vector3()
    template.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = (m.material as THREE.Material).name
      if (name === 'Metal_cintre') {
        const b = new THREE.Box3().setFromObject(m)
        hook = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)
      }
      // lay the design across the front panel, once, before the shirt is copied
      if (name === 'Face_T_shirt') projectFront(m, new THREE.Box3().setFromObject(m))
    })

    const spacing = photos.length > 1 ? Math.min(GAP, 1.0 / (photos.length - 1)) : 0
    photos.forEach((img, i) => {
      const colour = shirtColour(img)
      const shirt = template.clone(true)
      shirt.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const base = m.material as THREE.MeshStandardMaterial
        if (base.name === 'Face_T_shirt') {
          const mat = base.clone()
          mat.color.set(0xffffff)
          mat.map = frontTexture(img, colour, images[i].front ?? DEFAULT_FRONT)
          mat.roughness = 0.85
          m.material = mat
        } else if (base.name === 'Manches_et_dos_T_shirt') {
          const mat = base.clone()
          mat.color.copy(colour)
          mat.roughness = 0.85
          m.material = mat
        }
        m.userData.shirt = i
      })
      shirt.position.sub(hook) // hook at the pivot
      const pivot = new THREE.Group()
      pivot.add(shirt)
      const x = (i - (photos.length - 1) / 2) * spacing
      pivot.position.set(x, ROD_Y + 0.01, 0)
      this.scene.add(pivot)
      this.shirts.push({ pivot, turn: 0, x, lift: 0 })
    })
    this.kick()
  }

  /** turn a shirt to face the viewer (null: all side-on again) */
  setActive(i: number | null) {
    if (i === this.active) return
    this.active = i
    this.kick()
  }

  private listen() {
    const el = this.renderer.domElement
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      const hit = this.pick()
      if (hit !== this.hovered) {
        this.hovered = hit
        el.style.cursor = hit === null ? '' : 'pointer'
        // keep the turned shirt while the pointer is over the gap beside it
        if (hit !== null) this.onHover(hit)
      }
    }
    const leave = () => {
      this.hovered = null
      el.style.cursor = ''
      this.onHover(null)
    }
    const click = (e: PointerEvent) => {
      move(e)
      if (this.hovered !== null) this.onPick(this.hovered)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('click', click as EventListener)
    const ro = new ResizeObserver(() => this.resize())
    ro.observe(this.host)
    this.cleanup.push(() => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('click', click as EventListener)
      ro.disconnect()
    })
  }

  private pick(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObjects(
      this.shirts.map((s) => s.pivot),
      true,
    )[0]
    return hit ? ((hit.object.userData.shirt as number | undefined) ?? null) : null
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    // fit the whole rail (about 1.25 m wide, 1.6 m tall) whatever the shape of the box
    const fitH = 1.86
    const fitW = 1.45 / this.camera.aspect
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(fitH, fitW) / 2 / 3.9))
    this.camera.updateProjectionMatrix()
    this.kick()
  }

  /** run the animation loop until everything has settled */
  private kick() {
    if (this.raf || this.disposed) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private frame = (now: number) => {
    this.raf = 0
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let moving = false
    this.shirts.forEach((s, i) => {
      // the turned shirt takes OPEN of the rail; the others make way on either side
      let x = s.x
      if (this.active !== null && i !== this.active) {
        const push = (OPEN - GAP) / 2
        x += i < this.active ? -push : push
      }
      const turn = i === this.active ? 1 : 0
      const k = this.reduced ? 1 : 1 - Math.exp(-dt * 9)
      const before = s.turn + s.pivot.position.x
      s.turn += (turn - s.turn) * k
      s.pivot.position.x += (x - s.pivot.position.x) * k
      // side-on the shirt faces +X along the rod; turned, it faces the viewer (+Z)
      const sway = this.reduced ? 0 : Math.sin(now / 260 + i) * 0.06 * Math.abs(turn - s.turn)
      s.pivot.rotation.y = -Math.PI / 2 * s.turn
      s.pivot.rotation.z = sway
      if (Math.abs(s.turn + s.pivot.position.x - before) > 1e-4) moving = true
    })
    this.renderer.render(this.scene, this.camera)
    if (moving) this.kick()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.cleanup.forEach((f) => f())
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      const mat = m.material as THREE.MeshStandardMaterial
      mat.map?.dispose()
      mat.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
