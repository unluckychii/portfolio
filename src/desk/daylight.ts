import * as THREE from 'three'

/** how the room is lit at one moment of the day */
export type Light = {
  sun: number
  sunColor: string
  /** where the light comes from: low and warm early and late, high at midday */
  sunPos: [number, number, number]
  hemi: number
  sky: string
  ground: string
  /** reflections from the room around the desk */
  env: number
  /** the colour beyond the room (and of the fog that fades into it) */
  air: string
  exposure: number
}

const NIGHT: Light = {
  sun: 0.12, sunColor: '#8ea2d8', sunPos: [2.5, 3.5, 2.0],
  hemi: 0.07, sky: '#46506e', ground: '#2a241c',
  env: 0.035, air: '#1e1d22', exposure: 0.9,
}
const DAWN: Light = {
  sun: 1.5, sunColor: '#ffc796', sunPos: [-3.5, 2.0, 2.0],
  hemi: 0.6, sky: '#ffe2c8', ground: '#7a6a50',
  env: 0.3, air: '#dccdb6', exposure: 1.0,
}
const DAY: Light = {
  sun: 2.2, sunColor: '#fff1dc', sunPos: [-2.5, 4.0, 2.5],
  hemi: 0.9, sky: '#fff6e6', ground: '#8a7a5c',
  env: 0.45, air: '#e7e1cf', exposure: 1.05,
}
const GOLDEN: Light = {
  sun: 1.8, sunColor: '#ffad60', sunPos: [3.5, 2.0, 2.0],
  hemi: 0.62, sky: '#ffd8ad', ground: '#7a6248',
  env: 0.32, air: '#ddc5a2', exposure: 1.02,
}
const DUSK: Light = {
  sun: 0.45, sunColor: '#a493c8', sunPos: [3.0, 2.5, 2.0],
  hemi: 0.22, sky: '#605c80', ground: '#3a3028',
  env: 0.12, air: '#3e3a44', exposure: 0.95,
}

/** the day as keyframes (local hours); the light blends between them */
const DAYLIGHT: [number, Light][] = [
  [0, NIGHT],
  [5.5, NIGHT],
  [7, DAWN],
  [9, DAY],
  [16.5, DAY],
  [18.5, GOLDEN],
  [20.25, DUSK],
  [21.5, NIGHT],
  [24, NIGHT],
]

const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()

/** the light at `hour` (0–24, fractions allowed) */
export function lightAt(hour: number): Light {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < DAYLIGHT.length - 2 && DAYLIGHT[i + 1][0] <= h) i++
  const [h0, a] = DAYLIGHT[i]
  const [h1, b] = DAYLIGHT[i + 1]
  const raw = h1 > h0 ? (h - h0) / (h1 - h0) : 0
  const k = raw * raw * (3 - 2 * raw) // ease in and out
  const n = (x: number, y: number) => x + (y - x) * k
  return {
    sun: n(a.sun, b.sun),
    sunColor: mix(a.sunColor, b.sunColor, k),
    sunPos: [n(a.sunPos[0], b.sunPos[0]), n(a.sunPos[1], b.sunPos[1]), n(a.sunPos[2], b.sunPos[2])],
    hemi: n(a.hemi, b.hemi),
    sky: mix(a.sky, b.sky, k),
    ground: mix(a.ground, b.ground, k),
    env: n(a.env, b.env),
    air: mix(a.air, b.air, k),
    exposure: n(a.exposure, b.exposure),
  }
}

/**
 * The visitor's local time as an hour of the day. `?hour=21.5` in the address
 * overrides it, to preview the desk at any time.
 */
export function currentHour() {
  try {
    const forced = new URLSearchParams(window.location.search).get('hour')
    if (forced !== null && forced.trim() !== '' && !Number.isNaN(Number(forced))) return Number(forced)
  } catch {
    /* no address to read */
  }
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** dark enough that text over the desk needs to be light */
export const isDark = (l: Light) => l.hemi < 0.4
