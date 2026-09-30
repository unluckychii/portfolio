import s01 from './assets/sheet-01.webp'
import s02 from './assets/sheet-02.webp'
import s03 from './assets/sheet-03.webp'
import s04 from './assets/sheet-04.webp'
import s05 from './assets/sheet-05.webp'
import s06 from './assets/sheet-06.webp'
import s07 from './assets/sheet-07.webp'
import s08 from './assets/sheet-08.webp'
import s09 from './assets/sheet-09.webp'
import s10 from './assets/sheet-10.webp'
import s11 from './assets/sheet-11.webp'
import s12 from './assets/sheet-12.webp'

export type Specimen = {
  no: string
  latin: string
  common: string
  src: string
  pressed: string
  place: string
  note: string
  tape: 'top' | 'corners' | 'side'
}

export const SPECIMENS: Specimen[] = [
  { no: '01', latin: 'Symphyotrichum', common: 'Aster, violet', src: s01, pressed: '02 Jun', place: 'Roadside, north verge', note: 'Picked for the colour. Kept for the stems.', tape: 'top' },
  { no: '02', latin: 'Papaver cambricum', common: 'Welsh poppy', src: s02, pressed: '05 Jun', place: 'Garden wall, east', note: 'Tissue-thin. Held its yellow a week.', tape: 'corners' },
  { no: '03', latin: 'Bellis perennis', common: 'Daisy, scattered', src: s03, pressed: '09 Jun', place: 'The lawn nobody mowed', note: 'Forty heads, one afternoon.', tape: 'side' },
  { no: '04', latin: 'Hydrangea macrophylla', common: 'Hydrangea, bleached', src: s04, pressed: '11 Jun', place: 'Grandmother’s porch', note: 'Blue once. Paper now.', tape: 'top' },
  { no: '05', latin: 'Composite sheet', common: 'Lily, viola, crocus', src: s05, pressed: '12 Jun', place: 'Kitchen table', note: 'Everything left after the dinner.', tape: 'corners' },
  { no: '06', latin: 'Petunia × atkinsiana', common: 'Petunia, bronze', src: s06, pressed: '13 Jun', place: 'Window box, 3rd floor', note: 'Pressed too late. Better for it.', tape: 'side' },
  { no: '07', latin: 'Hibiscus syriacus', common: 'Rose of Sharon', src: s07, pressed: '14 Jun', place: 'Back garden, after rain', note: 'The one this whole book is for.', tape: 'top' },
  { no: '08', latin: 'Composite sheet', common: 'Fern & field daisy', src: s08, pressed: '18 Jun', place: 'Train window, eventually', note: 'Collected on the way. Arranged at home.', tape: 'corners' },
  { no: '09', latin: 'Rosa × centifolia', common: 'Rose petals, loose', src: s09, pressed: '21 Jun', place: 'A bouquet that outlived its reason', note: 'Longest day. Shortest vase life.', tape: 'side' },
  { no: '10', latin: 'Field kit', common: 'Sage, thistle, seed', src: s10, pressed: '24 Jun', place: 'Allotment 14', note: 'Dried, not pressed. Rules bend.', tape: 'top' },
  { no: '11', latin: 'Athyrium filix-femina', common: 'Lady fern', src: s11, pressed: '27 Jun', place: 'Shade by the stream', note: 'Unfurled in the press. Nearly.', tape: 'corners' },
  { no: '12', latin: 'Rosa ‘Peach’', common: 'Rose, peach', src: s12, pressed: '30 Jun', place: 'Last of the season', note: 'Closing the book on June.', tape: 'side' },
]

/** the sheet the camera dives into at the end of the scroll */
export const FEATURE = 6
