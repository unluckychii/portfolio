import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Light } from './daylight'

/** a sash window with curtains (CC BY 4.0, jesseroberts on Sketchfab — credited on the page) in public/models */
const WINDOW_MODEL = `${import.meta.env.BASE_URL}models/window.glb`

/** the back wall's surface */
export const WALL_Z = -1.25
/** the model is in centimetres, 55 wide; this makes it about 0.9 across the wall */
const WINDOW_SCALE = 0.0165
/** the window's sill sits just above the paintings */
const WINDOW_BOTTOM = 1.27
/** its centre, left to right */
const WINDOW_X = 0

/**
 * The hole the window fills, in the wall (x, y of its corners): inside the frame's
 * outer edge, so the frame hides the cut. Model units: z 39–83 across, y 18–78 up.
 */
export const WINDOW_HOLE = {
  x0: WINDOW_X - 22 * WINDOW_SCALE,
  x1: WINDOW_X + 22 * WINDOW_SCALE,
  y0: WINDOW_BOTTOM + (18 - 13.5) * WINDOW_SCALE,
  y1: WINDOW_BOTTOM + (78 - 13.5) * WINDOW_SCALE,
}
const HOLE_CENTRE = new THREE.Vector3((WINDOW_HOLE.x0 + WINDOW_HOLE.x1) / 2, (WINDOW_HOLE.y0 + WINDOW_HOLE.y1) / 2, WALL_Z)

/** how far out the sky is drawn behind the window */
const SKY_Z = -4.5

/** the back wall, with the window's opening cut out of it */
export function wallGeometry(width: number, height: number, centreY: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -height / 2)
  shape.lineTo(width / 2, -height / 2)
  shape.lineTo(width / 2, height / 2)
  shape.lineTo(-width / 2, height / 2)
  shape.closePath()
  const h = WINDOW_HOLE
  const hole = new THREE.Path()
  hole.moveTo(h.x0, h.y0 - centreY)
  hole.lineTo(h.x0, h.y1 - centreY)
  hole.lineTo(h.x1, h.y1 - centreY)
  hole.lineTo(h.x1, h.y0 - centreY)
  hole.closePath()
  shape.holes.push(hole)
  return new THREE.ShapeGeometry(shape)
}

/** a soft round glow, for the moon's halo */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,0.55)')
  r.addColorStop(0.3, 'rgba(255,255,255,0.18)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** the moon's face: a pale disc with a few darker seas */
function moonTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(110, 100, 10, 128, 128, 128)
  r.addColorStop(0, '#fffdf4')
  r.addColorStop(1, '#e4dfcc')
  g.fillStyle = r
  g.beginPath()
  g.arc(128, 128, 126, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(150, 146, 132, 0.28)'
  for (const [x, y, rad] of [[92, 96, 30], [150, 80, 22], [160, 150, 36], [100, 170, 18], [130, 120, 12]]) {
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The window over the desk and what's beyond it: a sky that follows the time of day,
 * the moon and stars at night, and the light that falls in through the glass —
 * sunlight by day, moonlight by night — throwing the frame's shadow across the desk.
 */
export class DeskWindow {
  readonly group = new THREE.Group()
  private skyCanvas = document.createElement('canvas')
  private skyTexture: THREE.CanvasTexture
  private moon: THREE.Mesh
  private halo: THREE.Sprite
  private stars: THREE.Points
  private light: THREE.SpotLight
  private disposables: { dispose(): void }[] = []

  constructor(scene: THREE.Scene, eye: THREE.Vector3) {
    // the sky, far enough out that it shifts only a little as the camera moves
    this.skyCanvas.width = 4
    this.skyCanvas.height = 256
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas)
    this.skyTexture.colorSpace = THREE.SRGBColorSpace
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 9),
      new THREE.MeshBasicMaterial({ map: this.skyTexture, fog: false, toneMapped: false }),
    )
    sky.position.set(0, 3.2, SKY_Z)

    // the moon, where the view from the desk through the window meets the sky
    const through = HOLE_CENTRE.clone().sub(eye)
    const at = eye.clone().addScaledVector(through, (SKY_Z + 0.05 - eye.z) / through.z)
    const glow = glowTexture()
    const face = moonTexture()
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 48),
      new THREE.MeshBasicMaterial({ map: face, transparent: true, fog: false, toneMapped: false }),
    )
    this.moon.position.set(at.x + 0.2, at.y + 0.18, SKY_Z + 0.05)
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#cfd9ff', transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    )
    this.halo.scale.setScalar(1.1)
    this.halo.position.copy(this.moon.position).setZ(SKY_Z + 0.04)

    // a scatter of stars around it
    const pts: number[] = []
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 160; i++) pts.push(at.x + (rand() - 0.5) * 6, at.y + (rand() - 0.35) * 4, SKY_Z + 0.03)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, fog: false, toneMapped: false }),
    )

    // the light through the glass: from outside, high, aimed down at the desk
    const light = new THREE.SpotLight('#fff4e2', 20, 9, 0.42, 0.7, 1.4)
    light.position.copy(HOLE_CENTRE).add(new THREE.Vector3(0.6, 1.5, -1.9))
    light.target.position.set(-0.55, 0, 0.1) // across the open desk to the left of the laptop
    light.castShadow = true
    light.shadow.mapSize.set(1024, 1024)
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.02
    light.shadow.radius = 3
    light.shadow.camera.near = 0.5
    light.shadow.camera.far = 9
    this.light = light

    this.group.add(sky, this.stars, this.halo, this.moon, light, light.target)
    scene.add(this.group)
    this.disposables.push(this.skyTexture, glow, face, sky.geometry, sky.material, this.moon.geometry, starGeo, light)
  }

  /** the window frame and curtains; until they load the opening is simply a hole */
  async load(loader: GLTFLoader) {
    const gltf = await loader.loadAsync(WINDOW_MODEL)
    const model = gltf.scene
    const paint = new THREE.MeshStandardMaterial({ color: '#efeae0', roughness: 0.55 })
    const linen = new THREE.MeshStandardMaterial({ color: '#ddd3c1', roughness: 1, side: THREE.DoubleSide })
    const metal = new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.4, metalness: 0.7 })
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = m.name || m.parent?.name || ''
      m.material = /Curtain/i.test(name) ? linen : /Rod|Ring/i.test(name) ? metal : paint
      m.castShadow = true
      m.receiveShadow = true
    })
    // its room side faces +X; turn it to face the room (+Z), then size and place it
    model.rotation.y = -Math.PI / 2
    model.scale.setScalar(WINDOW_SCALE)
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    model.position.set(WINDOW_X - (box.min.x + box.max.x) / 2, WINDOW_BOTTOM - box.min.y, WALL_Z - box.min.z - 0.005)
    this.group.add(model)
    this.disposables.push(paint, linen, metal)
  }

  /** match the sky, the moon and the light through the glass to the time of day */
  apply(l: Light) {
    const g = this.skyCanvas.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, this.skyCanvas.height)
    grad.addColorStop(0, l.skyTop)
    grad.addColorStop(1, l.skyLow)
    g.fillStyle = grad
    g.fillRect(0, 0, this.skyCanvas.width, this.skyCanvas.height)
    this.skyTexture.needsUpdate = true

    this.moon.visible = this.halo.visible = this.stars.visible = l.moon > 0.02
    ;(this.moon.material as THREE.MeshBasicMaterial).opacity = l.moon
    this.halo.material.opacity = l.moon
    ;(this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, l.moon * 1.2 - 0.2)

    this.light.intensity = l.win
    this.light.color.set(l.winColor)
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose())
  }
}
