import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { disposeStage, loadImage, makeStage } from './RailScene'

/** a suitcase record player (CC BY 4.0, Phaedrus on Sketchfab — credited on the page) */
const MODEL = `${import.meta.env.BASE_URL}models/record-player.glb`

/**
 * The model's own animation (10 s): the lid opens, the record rises out of its sleeve and
 * drops onto the platter, then it all packs away again. We drive it by hand: REST is the
 * moment the record sits on the platter; SWAP is when it's back in the sleeve, out of sight.
 */
const REST = 6
const SWAP = 2.05
/** how fast the animation runs (seconds of it per second) */
const RATE = 2.2
/** 33⅓ rpm */
const SPIN = (33.3 / 60) * Math.PI * 2

/** where the art goes on the model's textures (UV fractions): the sleeve's two faces, the record's two labels */
const SLEEVE_FACES = [
  { x0: 0.464, y0: 0.017, x1: 0.981, y1: 0.534 },
  { x0: 0.046, y0: 0.543, x1: 0.463, y1: 0.96 },
]
const LABELS = [
  { cx: 0.7202, cy: 0.3369, r: 0.1023 },
  { cx: 0.2891, cy: 0.7085, r: 0.1067 },
]

export type RecordLook = { title: string; artist: string; cover: string; colour: string }

/** draw an image to fill a box, cropping what doesn't fit */
function cover(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  g.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s)
}

/** a record's art: its album cover, or a plain square in its colour with the title */
function artFor(look: RecordLook, img: HTMLImageElement | null) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  if (img) {
    cover(g, img, 0, 0, 512, 512)
  } else {
    g.fillStyle = look.colour
    g.fillRect(0, 0, 512, 512)
    g.fillStyle = '#fff'
    g.font = 'italic 64px "Instrument Serif", Georgia, serif'
    g.textBaseline = 'bottom'
    g.fillText(look.title, 36, 470, 440)
  }
  return c
}

/**
 * The record player in 3D, in its own little stage: it opens and puts the record on, the record
 * spins while the music plays, and changing records lifts one off and drops the next on.
 */
export class RecordPlayerScene {
  onClick: () => void = () => {}
  reduced = false
  ready: Promise<void>

  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera = new THREE.PerspectiveCamera(28, 1, 1, 2000)
  private host: HTMLElement
  private mixer: THREE.AnimationMixer | null = null
  private record: THREE.Object3D | null = null
  private sleeveMat: THREE.MeshStandardMaterial | null = null
  private recordMat: THREE.MeshStandardMaterial | null = null
  private sleeveBase: (CanvasImageSource & { width: number; height: number }) | null = null
  private recordBase: (CanvasImageSource & { width: number; height: number }) | null = null
  private looks: RecordLook[]
  private art = new Map<number, HTMLCanvasElement>()
  /** where the animation is, and where it's heading */
  private t = 0
  private target = REST
  /** the record on the platter, and the one waiting to go on */
  private shown: number
  private pending: number | null = null
  private playing = false
  private speed = 0
  private angle = 0
  private centre = new THREE.Vector3()
  private size = 1
  private raf = 0
  private last = 0
  private disposed = false
  private cleanup: (() => void)[] = []

  constructor(host: HTMLElement, looks: RecordLook[], first: number) {
    this.host = host
    this.looks = looks
    this.shown = first
    const { renderer, scene } = makeStage(host)
    this.renderer = renderer
    this.scene = scene
    scene.environmentIntensity = 0.6
    renderer.domElement.style.cursor = 'pointer'
    const click = () => this.onClick()
    renderer.domElement.addEventListener('click', click)
    const ro = new ResizeObserver(() => this.resize())
    ro.observe(host)
    this.cleanup.push(() => {
      renderer.domElement.removeEventListener('click', click)
      ro.disconnect()
    })
    this.ready = this.build()
    this.resize()
  }

  private async build() {
    const loader = new GLTFLoader().register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager).setCrossOrigin('anonymous')
      return { name: 'player_img_element_textures' }
    })
    const [gltf, images] = await Promise.all([
      loader.loadAsync(MODEL),
      Promise.all(this.looks.map((l) => (l.cover ? loadImage(l.cover).catch(() => null) : Promise.resolve(null)))),
    ])
    if (this.disposed) return
    images.forEach((img, i) => this.art.set(i, artFor(this.looks[i], img)))
    const model = gltf.scene
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat.name === 'album_cover') {
        this.sleeveMat = mat
        this.sleeveBase = (mat.map?.image as HTMLImageElement | undefined) ?? null
        mat.normalMap = null // its embossed pattern would show through the album art
      }
      if (mat.name === 'album') {
        this.recordMat = mat
        this.recordBase = (mat.map?.image as HTMLImageElement | undefined) ?? null
      }
    })
    this.record = model.getObjectByName('Vinyl002') ?? null
    this.scene.add(model)
    this.mixer = new THREE.AnimationMixer(model)
    if (gltf.animations[0]) this.mixer.clipAction(gltf.animations[0]).play()

    // frame the player as it stands open with the record on
    this.mixer.setTime(REST)
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    box.getCenter(this.centre)
    this.size = box.getSize(new THREE.Vector3()).length()
    this.dress(this.shown)
    this.t = this.reduced ? REST : 0
    this.target = REST
    this.resize()
  }

  /** put a record's art on the sleeve and the record's labels */
  private dress(i: number) {
    const art = this.art.get(i)
    if (!art) return
    if (this.sleeveMat && this.sleeveBase) {
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      const g = c.getContext('2d')!
      g.drawImage(this.sleeveBase, 0, 0, 1024, 1024)
      for (const f of SLEEVE_FACES) g.drawImage(art, f.x0 * 1024, f.y0 * 1024, (f.x1 - f.x0) * 1024, (f.y1 - f.y0) * 1024)
      this.swapMap(this.sleeveMat, c)
    }
    if (this.recordMat && this.recordBase) {
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      const g = c.getContext('2d')!
      g.drawImage(this.recordBase, 0, 0, 1024, 1024)
      for (const l of LABELS) {
        const x = l.cx * 1024
        const y = l.cy * 1024
        const r = l.r * 1024
        g.save()
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.clip()
        g.drawImage(art, x - r, y - r, r * 2, r * 2)
        g.restore()
        g.fillStyle = '#111' // the spindle hole
        g.beginPath()
        g.arc(x, y, r * 0.07, 0, Math.PI * 2)
        g.fill()
      }
      this.swapMap(this.recordMat, c)
    }
  }

  private swapMap(mat: THREE.MeshStandardMaterial, c: HTMLCanvasElement) {
    const old = mat.map
    const t = new THREE.CanvasTexture(c)
    t.flipY = false // glTF texture coordinates
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    if (old) t.channel = old.channel
    mat.map = t
    mat.needsUpdate = true
    old?.dispose()
  }

  /** change records: the one on the platter goes back, the new one comes out of the sleeve */
  setRecord(i: number) {
    if (i === this.shown && this.pending === null) return
    if (this.reduced) {
      this.shown = i
      this.dress(i)
      this.kick()
      return
    }
    this.pending = i
    this.target = SWAP
    this.kick()
  }

  setPlaying(on: boolean) {
    this.playing = on
    this.kick()
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false) // the canvas follows its box (CSS), so it never holds the page wider than the screen
    this.camera.aspect = w / h
    // from the front and above, the whole player (lid open) and its sleeve in view
    const fit = this.size * 0.33
    const dist = fit / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.min(1, this.camera.aspect * 0.75)
    const dir = new THREE.Vector3(0.05, 0.62, 1).normalize()
    this.camera.position.copy(this.centre).addScaledVector(dir, dist)
    this.camera.near = dist / 20
    this.camera.far = dist * 4
    this.camera.lookAt(this.centre)
    this.camera.updateProjectionMatrix()
    this.kick()
  }

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
    if (this.mixer) {
      // move along the model's animation towards where we're heading
      if (this.t !== this.target) {
        const step = (this.reduced ? 99 : RATE) * dt
        this.t = this.t < this.target ? Math.min(this.target, this.t + step) : Math.max(this.target, this.t - step)
        moving = true
      } else if (this.pending !== null) {
        // the old record is away: dress the new one and bring it out
        this.shown = this.pending
        this.pending = null
        this.dress(this.shown)
        this.target = REST
        moving = true
      }
      this.mixer.setTime(this.t)

      // the record spins up while the music plays (only once it's on the platter)
      const want = this.playing && !this.reduced && this.t >= REST - 0.01 ? SPIN : 0
      this.speed += (want - this.speed) * Math.min(1, dt * (want > this.speed ? 2.5 : 1.5))
      if (want === 0 && this.speed < 0.05) this.speed = 0
      if (this.speed > 0) moving = true
      this.angle -= this.speed * dt
      if (this.record && this.angle !== 0) {
        this.record.updateMatrixWorld(true)
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.record.getWorldQuaternion(new THREE.Quaternion()).invert())
        this.record.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up.normalize(), this.angle))
      }
    }
    this.renderer.render(this.scene, this.camera)
    if (moving) this.kick()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.cleanup.forEach((f) => f())
    disposeStage(this.renderer, this.scene)
  }
}
