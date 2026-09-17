export interface CollectItem {
  id: string
  naam: string
  height: number
  /** Fallback colour when the sprite is missing. */
  color: string
}

export const ITEMS: CollectItem[] = [
  { id: 'bell', naam: 'Belletje', height: 30, color: '#e8b53a' },
  { id: 'bowtie', naam: 'Strikje', height: 80, color: '#5b6fd6' },
  { id: 'mouse-toy', naam: 'Speelmuis', height: 150, color: '#a9adb6' },
  { id: 'yarn', naam: 'Bolletje wol', height: 230, color: '#c8392f' },
  { id: 'fish', naam: 'Visje', height: 320, color: '#4aa3d8' },
  { id: 'feather', naam: 'Veertje', height: 430, color: '#8a5fc4' },
  { id: 'crown', naam: 'Kroontje', height: 560, color: '#e0a92c' },
  { id: 'helmet', naam: 'Astronautenhelm', height: 700, color: '#eef1f4' },
]

/** Items whose height lies in (from, to], so passing one picks it up exactly once. */
export function itemsBetween(from: number, to: number): CollectItem[] {
  return ITEMS.filter((it) => it.height > from && it.height <= to)
}

export function itemById(id: string): CollectItem | undefined {
  return ITEMS.find((it) => it.id === id)
}
