import { describe, expect, it } from 'vitest'
import { ITEMS, itemsBetween } from '../content/items'
import { ZONES, zoneAt, zoneBlend, zoneProgress } from '../content/zones'
import { applyAnswer, metresFor, newRound } from './progress'

describe('metres per answer', () => {
  it('gives 3 m for fast, 1 m for slow, 0 for wrong', () => {
    expect(metresFor('fast', 1)).toBe(3)
    expect(metresFor('slow', 0)).toBe(1)
    expect(metresFor('wrong', 0)).toBe(0)
  })

  it('adds a bonus metre from combo 5', () => {
    expect(metresFor('fast', 4)).toBe(3)
    expect(metresFor('fast', 5)).toBe(4)
  })
})

describe('round', () => {
  it('caps a perfect round around 75 m', () => {
    const round = newRound()
    let height = 0
    const collected = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const out = applyAnswer(round, 'fast', height, collected)
      height += out.metres
    }
    expect(round.gain).toBe(76)
    expect(round.combo).toBe(20)
    expect(round.fast).toBe(20)
  })

  it('lands a mixed round between 35 and 55 m', () => {
    const round = newRound()
    let height = 0
    const collected = new Set<string>()
    const pattern: ('fast' | 'slow' | 'wrong')[] = []
    for (let i = 0; i < 20; i++) pattern.push(i % 5 === 4 ? 'slow' : i % 7 === 6 ? 'wrong' : 'fast')
    for (const r of pattern) {
      const out = applyAnswer(round, r, height, collected)
      height += out.metres
    }
    expect(round.gain).toBeGreaterThanOrEqual(35)
    expect(round.gain).toBeLessThanOrEqual(55)
  })

  it('resets the combo on slow and on wrong, and never loses height', () => {
    const round = newRound()
    const collected = new Set<string>()
    let height = 10
    for (const r of ['fast', 'fast', 'slow', 'fast', 'wrong'] as const) {
      const out = applyAnswer(round, r, height, collected)
      expect(out.metres).toBeGreaterThanOrEqual(0)
      height += out.metres
    }
    expect(round.combo).toBe(0)
    expect(height).toBeGreaterThanOrEqual(10)
  })

  it('emits a combo event from 3 on', () => {
    const round = newRound()
    const collected = new Set<string>()
    const kinds: string[][] = []
    for (let i = 0; i < 4; i++) {
      kinds.push(applyAnswer(round, 'fast', i * 3, collected).events.map((e) => e.type))
    }
    expect(kinds[1]).not.toContain('combo')
    expect(kinds[2]).toContain('combo')
    expect(kinds[3]).toContain('combo')
  })

  it('ends after 20 sums', () => {
    const round = newRound()
    const collected = new Set<string>()
    let done = false
    for (let i = 0; i < 20; i++) done = applyAnswer(round, 'slow', i, collected).roundDone
    expect(done).toBe(true)
  })
})

describe('items', () => {
  it('unlocks each item exactly once at its height', () => {
    expect(itemsBetween(0, 30).map((i) => i.id)).toEqual(['bell'])
    expect(itemsBetween(30, 30).length).toBe(0)
    expect(itemsBetween(29, 31).map((i) => i.id)).toEqual(['bell'])
    expect(itemsBetween(0, 700).length).toBe(ITEMS.length)
  })

  it('collects an item when the jump passes its height', () => {
    const round = newRound()
    const collected = new Set<string>()
    const out = applyAnswer(round, 'fast', 28, collected)
    expect(out.events.some((e) => e.type === 'itemCollected' && e.id === 'bell')).toBe(true)
    const again = applyAnswer(round, 'fast', 31, collected)
    expect(again.events.some((e) => e.type === 'itemCollected')).toBe(false)
  })

  it('has items in ascending order', () => {
    for (let i = 1; i < ITEMS.length; i++) expect(ITEMS[i].height).toBeGreaterThan(ITEMS[i - 1].height)
  })
})

describe('zones', () => {
  it('maps the documented boundaries', () => {
    expect(zoneAt(0).id).toBe('woonkamer')
    expect(zoneAt(99.9).id).toBe('woonkamer')
    expect(zoneAt(100).id).toBe('zolder')
    expect(zoneAt(249).id).toBe('zolder')
    expect(zoneAt(250).id).toBe('dak')
    expect(zoneAt(449).id).toBe('dak')
    expect(zoneAt(450).id).toBe('wolken')
    expect(zoneAt(699).id).toBe('wolken')
    expect(zoneAt(700).id).toBe('ruimte')
    expect(zoneAt(99999).id).toBe('ruimte')
  })

  it('leaves no gaps between zones', () => {
    for (let i = 1; i < ZONES.length; i++) expect(ZONES[i].from).toBe(ZONES[i - 1].to)
  })

  it('runs progress from 0 to 1 inside a zone', () => {
    expect(zoneProgress(0)).toBe(0)
    expect(zoneProgress(50)).toBeCloseTo(0.5, 5)
    expect(zoneProgress(175)).toBeCloseTo(0.5, 5)
    expect(zoneProgress(99.999)).toBeGreaterThan(0.99)
  })

  it('crossfades over the last 10 m of a zone', () => {
    expect(zoneBlend(80).mix).toBe(0)
    expect(zoneBlend(95).mix).toBeCloseTo(0.5, 5)
    expect(zoneBlend(99).mix).toBeCloseTo(0.9, 5)
    expect(zoneBlend(95).next.id).toBe('zolder')
  })

  it('reports a zone change on the jump that crosses a boundary', () => {
    const round = newRound()
    const collected = new Set<string>()
    const out = applyAnswer(round, 'fast', 98, collected)
    expect(out.events.some((e) => e.type === 'zoneChanged' && e.id === 'zolder')).toBe(true)
  })
})
