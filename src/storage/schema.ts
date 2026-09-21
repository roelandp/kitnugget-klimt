import { EMPTY_LOOK, type Look } from '../content/looks'
import type { EngineSnapshot } from '../engine/engine'

export const STORAGE_KEY = 'kitnugget.v1'
export const SCHEMA_VERSION = 1

export type MouseStyle = 'muis' | 'ring'
export type InputMode = 'keuze' | 'open'

export interface Settings {
  tables: number[]
  /** Sound effects. */
  sound: boolean
  /** Background music loop. */
  music: boolean
  timerStyle: MouseStyle
  inputMode: InputMode
  timeScale: number
  guessDelay: number
}

export interface TestResult {
  at: number
  tables: number[]
  count: number
  seconds: number
  correct: number
  wrong: string[]
  skipped: string[]
}

export type KrabpaalSlot = 'top' | 'links' | 'rechts' | 'onder'
export const KRABPAAL_SLOTS: { id: KrabpaalSlot; label: string; icon: string }[] = [
  { id: 'top', label: 'Bovenop de paal', icon: '👑' },
  { id: 'links', label: 'Linker plateau', icon: '🌿' },
  { id: 'rechts', label: 'Rechter plateau', icon: '🧶' },
  { id: 'onder', label: 'Onderste mandje', icon: '🧺' },
]

export const DEFAULT_DECORATIONS: Record<KrabpaalSlot, string | null> = {
  top: null,
  links: null,
  rechts: null,
  onder: null,
}

export interface Profile {
  naam: string
  totalHeight: number
  bestRound: number
  roundsPlayed: number
  daysPlayed: number
  lastPlayedDay: string | null
  lastPlayedAt: number
  roundsToday: number
  collected: string[]
  decorations: Record<KrabpaalSlot, string | null>
  /** The hat and fur pattern Kit Nugget is wearing. */
  look: Look
  settings: Settings
  engine: Partial<EngineSnapshot>
  tests: TestResult[]
}

export interface SaveFile {
  schemaVersion: number
  activeProfile: string
  profiles: Record<string, Profile>
}

export const DEFAULT_TABLES = [5, 6, 7, 8, 9]

export function emptyProfile(naam = 'Viggo'): Profile {
  return {
    naam,
    totalHeight: 0,
    bestRound: 0,
    roundsPlayed: 0,
    daysPlayed: 0,
    lastPlayedDay: null,
    lastPlayedAt: 0,
    roundsToday: 0,
    collected: [],
    decorations: { ...DEFAULT_DECORATIONS },
    look: { ...EMPTY_LOOK },
    settings: { tables: [...DEFAULT_TABLES], sound: true, music: true, timerStyle: 'muis', inputMode: 'keuze', timeScale: 1, guessDelay: 7 },
    engine: {},
    tests: [],
  }
}

export function emptySave(): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfile: 'viggo',
    profiles: { viggo: emptyProfile() },
  }
}

/** Brings older or partial saves up to the current shape. Never throws. */
export function migrate(raw: unknown): SaveFile {
  const base = emptySave()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<SaveFile>
  const out: SaveFile = {
    schemaVersion: SCHEMA_VERSION,
    activeProfile: typeof data.activeProfile === 'string' ? data.activeProfile : 'viggo',
    profiles: {},
  }
  const profiles = data.profiles && typeof data.profiles === 'object' ? data.profiles : {}
  for (const [key, value] of Object.entries(profiles)) {
    const p = emptyProfile()
    const v = (value ?? {}) as Partial<Profile>
    const coll = Array.isArray(v.collected) ? v.collected : []
    const dec: Record<KrabpaalSlot, string | null> = {
      ...DEFAULT_DECORATIONS,
      ...(v.decorations && typeof v.decorations === 'object' ? v.decorations : {}),
    }
    // If all slots are empty and user already has collected items, auto-fill
    if (!Object.values(dec).some(Boolean) && coll.length > 0) {
      const slotIds: KrabpaalSlot[] = ['top', 'links', 'rechts', 'onder']
      coll.slice(0, 4).forEach((itemId, idx) => {
        dec[slotIds[idx]] = itemId
      })
    }
    const look = (v.look ?? {}) as Partial<Look>
    out.profiles[key] = {
      ...p,
      ...v,
      decorations: dec,
      look: {
        hats: Array.isArray(look.hats) ? look.hats : (typeof (look as any).hat === 'string' ? [(look as any).hat] : []),
        cape: typeof look.cape === 'string' ? look.cape : null,
        pattern: typeof look.pattern === 'string' ? look.pattern : null,
      },
      settings: {
        ...p.settings,
        ...(v.settings ?? {}),
        inputMode: v.settings?.inputMode === 'open' ? 'open' : 'keuze',
        timeScale: typeof v.settings?.timeScale === 'number' ? v.settings.timeScale : 1,
        guessDelay: typeof v.settings?.guessDelay === 'number' ? v.settings.guessDelay : 7,
      },
      collected: coll,
      tests: Array.isArray(v.tests) ? v.tests.slice(-10) : [],
      engine: v.engine && typeof v.engine === 'object' ? v.engine : {},
    }
  }
  if (!out.profiles[out.activeProfile]) {
    out.profiles[out.activeProfile] = emptyProfile()
  }
  return out
}
