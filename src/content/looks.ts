import { itemById } from './items'

/** What Kit Nugget is wearing. Both fields are ids, or null for nothing. */
export interface Look {
  hats: string[]
  cape: string | null
  pattern: string | null
}

export const EMPTY_LOOK: Look = { hats: [], pattern: null, cape: null }

/** `head` sits on the skull, `face` sits over the eyes. */
export type HatMount = 'head' | 'face'

export interface Hat {
  id: string
  naam: string
  /** `item` reuses the collectible art, `draw` is painted in code. */
  source: 'item' | 'draw'
  mount: HatMount
  /** Unlock height in metres. Item hats unlock by collecting the item instead. */
  height: number
  /** Width as a fraction of the head width. */
  scale: number
  /** Nudges in head widths, before the head tilt is applied. */
  dx: number
  dy: number
  /** Extra tilt in degrees on top of the head tilt. */
  rot: number
}

/**
 * Everything Kit Nugget can put on his head. The collectibles double as hats,
 * the drawn ones are the silly extras that unlock between the item heights.
 */
export const HATS: Hat[] = [
  { id: 'bell', naam: 'Belletje', source: 'item', mount: 'head', height: 30, scale: 0.34, dx: 0.04, dy: 0.06, rot: 0 },
  { id: 'ketting', naam: 'Blingbling', source: 'draw', mount: 'head', height: 110, scale: 1.2, dx: 0, dy: 0.7, rot: 0 },
  { id: 'zonnebril', naam: 'Zonnebril', source: 'draw', mount: 'face', height: 60, scale: 0.82, dx: 0, dy: 0, rot: 0 },
  { id: 'bowtie', naam: 'Strikje', source: 'item', mount: 'head', height: 80, scale: 0.55, dx: 0, dy: 0.04, rot: -8 },
  { id: 'mouse-toy', naam: 'Speelmuis', source: 'item', mount: 'head', height: 150, scale: 0.72, dx: 0, dy: 0.06, rot: -6 },
  { id: 'hogehoed', naam: 'Hoge hoed', source: 'draw', mount: 'head', height: 190, scale: 0.82, dx: 0, dy: 0.02, rot: 0 },
  { id: 'yarn', naam: 'Bolletje wol', source: 'item', mount: 'head', height: 230, scale: 0.6, dx: 0, dy: 0.04, rot: 0 },
  { id: 'fish', naam: 'Visje', source: 'item', mount: 'head', height: 320, scale: 0.9, dx: 0, dy: 0.05, rot: -10 },
  { id: 'lama', naam: 'Kleine lama', source: 'draw', mount: 'head', height: 380, scale: 0.78, dx: 0, dy: 0.02, rot: 0 },
  { id: 'feather', naam: 'Veertje', source: 'item', mount: 'head', height: 430, scale: 0.46, dx: 0.16, dy: 0.05, rot: 16 },
  { id: 'crown', naam: 'Kroontje', source: 'item', mount: 'head', height: 560, scale: 0.78, dx: 0, dy: 0.05, rot: 0 },
  { id: 'helmet', naam: 'Astronautenhelm', source: 'item', mount: 'head', height: 700, scale: 0.74, dx: 0, dy: 0.07, rot: 0 },
]


export interface CapeColor {
  id: string
  naam: string
  color: string
}
export const CAPES: CapeColor[] = [
  { id: 'rood', naam: 'Rode cape', color: '#e74c3c' },
  { id: 'blauw', naam: 'Blauwe cape', color: '#3498db' },
  { id: 'groen', naam: 'Groene cape', color: '#2ecc71' },
  { id: 'paars', naam: 'Paarse cape', color: '#9b59b6' },
  { id: 'zwart', naam: 'Zwarte cape', color: '#2c3e50' },
  { id: 'goud', naam: 'Gouden cape', color: '#f1c40f' },
]

export function capeById(id: string | null): CapeColor | undefined {
  return id ? CAPES.find((c) => c.id === id) : undefined
}

export interface Pattern {
  id: string
  naam: string
  height: number
}

/** Fur patterns painted over the sprite, inside its silhouette. */
export const PATTERNS: Pattern[] = [
  { id: 'tijger', naam: 'Tijgerstrepen', height: 0 },
  { id: 'zebra', naam: 'Zebrastrepen', height: 120 },
  { id: 'luipaard', naam: 'Luipaardvlekjes', height: 300 },
]

export function hatById(id: string | null): Hat | undefined {
  return id ? HATS.find((h) => h.id === id) : undefined
}

export function patternById(id: string | null): Pattern | undefined {
  return id ? PATTERNS.find((p) => p.id === id) : undefined
}

/** An item hat needs the item itself, a drawn hat only needs the height. */
export function hatUnlocked(hat: Hat, collected: Iterable<string>, totalHeight: number): boolean {
  if (hat.source === 'item') return [...collected].includes(hat.id)
  return totalHeight >= hat.height
}

export function patternUnlocked(pattern: Pattern, totalHeight: number): boolean {
  return totalHeight >= pattern.height
}

/** Why a hat is not available yet, in Dutch, for the locked chips. */
export function hatLockedText(hat: Hat): string {
  if (hat.source === 'item') {
    const item = itemById(hat.id)
    return `vind op ${item ? item.height : hat.height} m`
  }
  return `op ${hat.height} m`
}

/** Drops anything that is no longer unlocked, so a wiped profile cannot keep a hat. */
export function sanitiseLook(look: Look, collected: Iterable<string>, totalHeight: number): Look {
  const hats = (look.hats || []).filter((id) => {
    const h = hatById(id)
    return h && hatUnlocked(h, collected, totalHeight)
  })
  const pattern = patternById(look.pattern)
  return {
    hats,
    cape: look.cape || null,
    pattern: pattern && patternUnlocked(pattern, totalHeight) ? pattern.id : null,
  }
}
