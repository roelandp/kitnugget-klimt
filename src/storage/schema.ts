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
    settings: { tables: [...DEFAULT_TABLES], sound: true, music: true, timerStyle: 'muis', inputMode: 'keuze' },
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
    out.profiles[key] = {
      ...p,
      ...v,
      settings: {
        ...p.settings,
        ...(v.settings ?? {}),
        inputMode: v.settings?.inputMode === 'open' ? 'open' : 'keuze',
      },
      collected: Array.isArray(v.collected) ? v.collected : [],
      tests: Array.isArray(v.tests) ? v.tests.slice(-10) : [],
      engine: v.engine && typeof v.engine === 'object' ? v.engine : {},
    }
  }
  if (!out.profiles[out.activeProfile]) {
    out.profiles[out.activeProfile] = emptyProfile()
  }
  return out
}
