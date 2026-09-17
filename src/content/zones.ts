export interface Zone {
  id: 'woonkamer' | 'zolder' | 'dak' | 'wolken' | 'ruimte'
  naam: string
  from: number
  to: number
  /** Fallback gradient when the background image is missing. */
  gradient: [string, string]
}

export type ZoneId = Zone['id']

export const ZONES: Zone[] = [
  { id: 'woonkamer', naam: 'Woonkamer', from: 0, to: 100, gradient: ['#f0c48a', '#a8683c'] },
  { id: 'zolder', naam: 'Zolder', from: 100, to: 250, gradient: ['#d9955c', '#6b3b23'] },
  { id: 'dak', naam: 'Dak', from: 250, to: 450, gradient: ['#f0a06a', '#3c2f66'] },
  { id: 'wolken', naam: 'Wolken', from: 450, to: 700, gradient: ['#9fd4f5', '#1b4a8a'] },
  { id: 'ruimte', naam: 'Ruimte', from: 700, to: Infinity, gradient: ['#1b2a6b', '#080a1e'] },
]

/** Crossfade width in metres at a zone boundary. */
export const ZONE_FADE = 10

export function zoneAt(height: number): Zone {
  for (const z of ZONES) {
    if (height >= z.from && height < z.to) return z
  }
  return ZONES[ZONES.length - 1]
}

/** 0..1 progress within the current zone; the last zone wraps every 300 m. */
export function zoneProgress(height: number): number {
  const z = zoneAt(height)
  if (!Number.isFinite(z.to)) {
    return ((height - z.from) % 300) / 300
  }
  return Math.min(1, Math.max(0, (height - z.from) / (z.to - z.from)))
}

/**
 * Which two zones to draw and how to mix them. `mix` is how much of `next` shows.
 * Used for the 10 m crossfade at a boundary.
 */
export function zoneBlend(height: number): { current: Zone; next: Zone; mix: number } {
  const current = zoneAt(height)
  const index = ZONES.indexOf(current)
  const next = ZONES[Math.min(index + 1, ZONES.length - 1)]
  if (!Number.isFinite(current.to) || next === current) return { current, next, mix: 0 }
  const distance = current.to - height
  const mix = distance < ZONE_FADE ? 1 - distance / ZONE_FADE : 0
  return { current, next, mix: Math.min(1, Math.max(0, mix)) }
}
