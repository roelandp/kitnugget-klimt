import { describe, expect, it } from 'vitest'
import { Engine, WEAK_SHARE } from './engine'
import { LIMIT_MAX, LIMIT_MIN, dayKey, emptyState, limitOf, statusOf } from './facts'
import type { FactState } from './types'

const TABLES = [5, 6, 7, 8, 9]

function fixedClock(start: number) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

function makeEngine(seed = 1, extra: Partial<ConstructorParameters<typeof Engine>[0]> = {}) {
  return new Engine({ tables: TABLES, seed, ...extra })
}

describe('status transitions', () => {
  it('starts at nieuw', () => {
    expect(statusOf(emptyState('7x8'))).toBe('nieuw')
  })

  it('drops to oefenen after a wrong answer, whatever came before', () => {
    const state: FactState = {
      ...emptyState('7x8'),
      seen: 9,
      correct: 9,
      rtEma: 1.5,
      streakFast: 5,
      fastDays: ['2026-09-01', '2026-09-02', '2026-09-03'],
      lastCorrect: true,
      recent: [true, true, true],
    }
    expect(statusOf(state)).toBe('geautomatiseerd')
    state.lastCorrect = false
    state.streakFast = 0
    state.recent = [true, true, false]
    expect(statusOf(state)).toBe('oefenen')
  })

  it('is oefenen while rtEma stays above 5 s', () => {
    const state: FactState = { ...emptyState('7x8'), seen: 3, correct: 3, rtEma: 5.4, lastCorrect: true, recent: [true, true, true] }
    expect(statusOf(state)).toBe('oefenen')
    state.rtEma = 4.2
    expect(statusOf(state)).toBe('snel')
  })

  it('needs the last two right to count as snel', () => {
    const state: FactState = { ...emptyState('7x8'), seen: 3, correct: 2, rtEma: 4, lastCorrect: true, recent: [true, false, true] }
    expect(statusOf(state)).toBe('oefenen')
    state.recent = [false, true, true]
    expect(statusOf(state)).toBe('snel')
  })

  it('reaches geautomatiseerd only with 3 fast in a row on 2 different days', () => {
    const state: FactState = { ...emptyState('7x8'), seen: 5, correct: 5, rtEma: 2, streakFast: 3, fastDays: ['2026-09-01'], lastCorrect: true, recent: [true, true] }
    expect(statusOf(state)).toBe('snel')
    state.fastDays = ['2026-09-01', '2026-09-02']
    expect(statusOf(state)).toBe('geautomatiseerd')
    state.streakFast = 2
    expect(statusOf(state)).toBe('snel')
  })

  it('walks a fact from nieuw to geautomatiseerd through the engine', () => {
    const clock = fixedClock(Date.parse('2026-09-15T10:00:00'))
    const engine = makeEngine(7, { now: clock.now })
    const fact = engine.facts.find((f) => f.key === '7x8')!
    expect(engine.statusOf('7x8')).toBe('nieuw')

    engine.record(fact, 56, 4.2)
    expect(engine.statusOf('7x8')).toBe('oefenen')
    engine.record(fact, 56, 3.8)
    expect(engine.statusOf('7x8')).toBe('snel')

    engine.record(fact, 56, 1.2)
    engine.record(fact, 56, 1.2)
    engine.record(fact, 56, 1.2)
    expect(engine.statusOf('7x8')).toBe('snel')

    clock.advance(24 * 60 * 60 * 1000)
    engine.record(fact, 56, 1.2)
    expect(engine.statusOf('7x8')).toBe('geautomatiseerd')

    engine.record(fact, 55, 1.2)
    expect(engine.statusOf('7x8')).toBe('oefenen')
  })

  it('counts fast days by local calendar date', () => {
    const a = dayKey(Date.parse('2026-09-15T23:59:00'))
    const b = dayKey(Date.parse('2026-09-16T00:01:00'))
    expect(a).not.toBe(b)
  })
})

describe('time limit', () => {
  it('starts at 6 s', () => {
    expect(limitOf(emptyState('7x8'))).toBe(6)
  })

  it('is clamped to 3..6 s', () => {
    expect(limitOf({ ...emptyState('7x8'), rtEma: 0.5 })).toBe(LIMIT_MIN)
    expect(limitOf({ ...emptyState('7x8'), rtEma: 20 })).toBe(LIMIT_MAX)
    expect(limitOf({ ...emptyState('7x8'), rtEma: 3.2 })).toBeCloseTo(4, 5)
  })
})

describe('reverse rule', () => {
  it('lets a wrong answer pull its partner back to oefenen', () => {
    const engine = makeEngine(3)
    const a = engine.facts.find((f) => f.key === '7x8')!
    const b = engine.facts.find((f) => f.key === '8x7')!
    engine.record(b, 56, 2)
    engine.record(b, 56, 2)
    expect(engine.statusOf('8x7')).toBe('snel')
    engine.record(a, 54, 3)
    expect(engine.statusOf('8x7')).toBe('oefenen')
  })

  it('does not touch a square', () => {
    const engine = makeEngine(3)
    const f = engine.facts.find((x) => x.key === '7x7')!
    expect(() => engine.record(f, 48, 3)).not.toThrow()
  })
})

describe('picker', () => {
  it('never asks the same fact or pair twice in a row', () => {
    const engine = makeEngine(42)
    let prev: { key: string; pairKey: string } | null = null
    for (let i = 0; i < 400; i++) {
      const sel = engine.next()
      if (prev) {
        expect(sel.fact.key).not.toBe(prev.key)
        expect(sel.fact.pairKey).not.toBe(prev.pairKey)
      }
      prev = { key: sel.fact.key, pairKey: sel.fact.pairKey }
      // Mix of right and wrong so both pools stay populated.
      const right = i % 3 !== 0
      engine.record(sel.fact, right ? sel.fact.a * sel.fact.b : 0, right ? 2 : 5)
    }
  })

  it('brings a wrong fact back within 3 turns', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const engine = makeEngine(seed)
      const first = engine.next()
      engine.record(first.fact, -1, 4)
      let seenAgain = -1
      for (let turn = 1; turn <= 3; turn++) {
        const sel = engine.next()
        if (sel.fact.key === first.fact.key) {
          seenAgain = turn
          engine.record(sel.fact, sel.fact.a * sel.fact.b, 2)
          break
        }
        engine.record(sel.fact, sel.fact.a * sel.fact.b, 2)
      }
      expect(seenAgain, `seed ${seed}`).toBeGreaterThan(0)
      expect(seenAgain).toBeLessThanOrEqual(3)
    }
  })

  it('draws roughly 70/30 from weak and strong pools', () => {
    // Half the facts are made automatic up front so both pools are large.
    const engine = makeEngine(1234)
    const snapshot = engine.snapshot()
    engine.facts.forEach((f, i) => {
      if (i % 2 === 0) {
        snapshot.states[f.key] = {
          ...emptyState(f.key),
          seen: 6,
          correct: 6,
          rtEma: 1.4,
          streakFast: 4,
          fastDays: ['2026-09-01', '2026-09-02'],
          lastCorrect: true,
          recent: [true, true, true],
        }
      }
    })
    const seeded = new Engine({ tables: TABLES, seed: 1234, snapshot })
    const counts = { weak: 0, strong: 0, queue: 0 }
    for (let i = 0; i < 1000; i++) {
      const sel = seeded.next()
      counts[sel.pool] += 1
      // Answer correctly and fast so nothing changes pool and nothing is queued.
      const state = seeded.stateOf(sel.fact.key)
      const before = { ...state, fastDays: [...state.fastDays], recent: [...state.recent] }
      seeded.record(sel.fact, sel.fact.a * sel.fact.b, 2)
      Object.assign(state, before)
    }
    expect(counts.queue).toBe(0)
    const share = counts.weak / 1000
    expect(share).toBeGreaterThan(WEAK_SHARE - 0.05)
    expect(share).toBeLessThan(WEAK_SHARE + 0.05)
  })

  it('gives b = 1 and b = 10 a low weight', () => {
    const engine = makeEngine(99)
    let edge = 0
    const draws = 2000
    for (let i = 0; i < draws; i++) {
      const sel = engine.next()
      if (sel.fact.b === 1 || sel.fact.b === 10) edge += 1
      const state = engine.stateOf(sel.fact.key)
      const before = { ...state, fastDays: [...state.fastDays], recent: [...state.recent] }
      engine.record(sel.fact, sel.fact.a * sel.fact.b, 2)
      Object.assign(state, before)
    }
    // 2 of every 10 facts are edge cases; weighting should push this well under 20 %.
    expect(edge / draws).toBeLessThan(0.12)
  })
})

describe('snapshot', () => {
  it('round-trips through a snapshot', () => {
    const engine = makeEngine(5)
    for (let i = 0; i < 30; i++) {
      const sel = engine.next()
      engine.record(sel.fact, i % 4 === 0 ? 0 : sel.fact.a * sel.fact.b, 2.5)
    }
    const snap = engine.snapshot()
    const restored = new Engine({ tables: TABLES, seed: 5, snapshot: snap })
    for (const f of engine.facts) {
      expect(restored.statusOf(f.key)).toBe(engine.statusOf(f.key))
      expect(restored.limitOf(f.key)).toBeCloseTo(engine.limitOf(f.key), 6)
    }
  })
})
