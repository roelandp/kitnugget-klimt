import type { Fact, FactState, Status } from './types'

export const B_MIN = 1
export const B_MAX = 10

/** A correct answer at or under this many seconds counts as "fast" for automation. */
export const FAST_SECONDS = 3
export const LIMIT_START = 6
export const LIMIT_MIN = 3
export const LIMIT_MAX = 6
export const RT_ALPHA = 0.4
export const RECENT_WINDOW = 5

export function factKey(a: number, b: number): string {
  return `${a}x${b}`
}

export function pairKey(a: number, b: number): string {
  return a <= b ? `${a}x${b}` : `${b}x${a}`
}

export function makeFact(a: number, b: number): Fact {
  return { key: factKey(a, b), a, b, pairKey: pairKey(a, b) }
}

/** All facts for the chosen tables, a from `tables`, b from 1..10. */
export function buildFacts(tables: number[]): Fact[] {
  const out: Fact[] = []
  for (const a of tables) {
    for (let b = B_MIN; b <= B_MAX; b++) out.push(makeFact(a, b))
  }
  return out
}

export function emptyState(key: string): FactState {
  return {
    key,
    seen: 0,
    correct: 0,
    wrong: 0,
    rtEma: null,
    streakFast: 0,
    fastDays: [],
    lastSeen: 0,
    lastCorrect: null,
    recent: [],
  }
}

function lastNCorrect(state: FactState, n: number): boolean {
  if (state.recent.length < n) return false
  return state.recent.slice(-n).every(Boolean)
}

export function statusOf(state: FactState): Status {
  if (state.seen === 0) return 'nieuw'
  // A wrong answer always drops the fact back to practising.
  if (state.lastCorrect === false) return 'oefenen'
  if (state.streakFast >= 3 && state.fastDays.length >= 2) return 'geautomatiseerd'
  if (state.rtEma === null) return 'oefenen'
  if (state.rtEma > 5) return 'oefenen'
  return lastNCorrect(state, 2) ? 'snel' : 'oefenen'
}

/** Per-fact time limit in seconds. */
export function limitOf(state: FactState): number {
  if (state.rtEma === null) return LIMIT_START
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, state.rtEma * 1.25))
}

export function ema(prev: number | null, value: number, alpha = RT_ALPHA): number {
  return prev === null ? value : prev * (1 - alpha) + value * alpha
}

export function pushRecent(state: FactState, correct: boolean): void {
  state.recent.push(correct)
  if (state.recent.length > RECENT_WINDOW) state.recent.shift()
}

export function isWeak(status: Status): boolean {
  return status === 'nieuw' || status === 'oefenen'
}

/** Local calendar date, used to count "fast on N distinct days". */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
