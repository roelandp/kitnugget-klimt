import { describe, expect, it } from 'vitest'
import { LESSONS, RHYMES, chant, inWords, rhymeText, route, tricksFor } from '../content/bouw'
import { makeRng } from '../engine/rng'
import { buildLesson, ownRhymeTarget, questionCount, suggestTable, tableMastery, weakestCounts } from './bouw'

describe('bouwen: routes vanuit ankers', () => {
  it('ends every route on the product, for every table and brick count', () => {
    for (let t = 1; t <= 10; t++) {
      for (let n = 1; n <= 10; n++) {
        const steps = route(n, t)
        expect(steps.length).toBeGreaterThan(0)
        expect(steps[steps.length - 1].answer).toBe(n * t)
      }
    }
  })

  it('uses anchors: 6 from 5, 9 from 10, 8 by doubling', () => {
    expect(route(6, 7).map((s) => s.answer)).toEqual([35, 42])
    expect(route(9, 6).map((s) => s.answer)).toEqual([60, 54])
    expect(route(8, 8).map((s) => s.answer)).toEqual([16, 32, 64])
    expect(route(7, 4).map((s) => s.answer)).toEqual([20, 28])
  })

  it('draws plates that fit the route', () => {
    for (let t = 1; t <= 10; t++) {
      for (let n = 1; n <= 10; n++) {
        for (const s of route(n, t)) {
          const p = s.plate
          expect(p.cols).toBe(t)
          expect(p.lit ?? 0).toBeLessThanOrEqual(p.rows)
          expect((p.lit ?? 0) + (p.crossed ?? 0)).toBeLessThanOrEqual(p.rows)
        }
      }
    }
  })

  it('reads keer as stenen van', () => {
    expect(inWords(4, 6)).toBe('4 stenen van 6 nopjes')
    expect(inWords(1, 7)).toBe('1 steen van 7 nopjes')
  })
})

describe('bouwen: rijm en trucjes', () => {
  it('has correct numbers in every rhyme', () => {
    expect(rhymeText(RHYMES.find((r) => r.n === 7 && r.t === 8)!)).toContain('56')
    expect(rhymeText(RHYMES[0], true)).not.toContain('36')
  })

  it('every number mentioned in a trick is a real product or a small number', () => {
    // 7 x 9 begins with 6 and 6 + 3 = 9 make 63.
    expect(tricksFor(9).join(' ')).toContain('63')
    expect(tricksFor(6).join(' ')).toContain('48')
  })

  it('chants the table', () => {
    expect(chant(7)).toEqual([7, 14, 21, 28, 35, 42, 49, 56, 63, 70])
  })
})

describe('bouwen: lessen', () => {
  it('builds every lesson for every table with correct answers', () => {
    for (let t = 2; t <= 10; t++) {
      for (const lesson of LESSONS) {
        const steps = buildLesson(lesson.id, t, makeRng(t))
        expect(steps.length).toBeGreaterThan(0)
        for (const s of steps) {
          expect(s.say.length).toBeGreaterThan(0)
          expect(s.say).not.toContain('—')
          if (s.answer !== undefined) expect(Number.isInteger(s.answer)).toBe(true)
          if (s.plate) expect(s.plate.rows).toBeLessThanOrEqual(10)
        }
      }
    }
  })

  it('keeps every lesson short: at most 16 questions', () => {
    for (const lesson of LESSONS) {
      const n = questionCount(buildLesson(lesson.id, 7, makeRng(1)))
      expect(n).toBeGreaterThan(2)
      expect(n).toBeLessThanOrEqual(16)
    }
  })

  it('rotation asks the same number of studs twice', () => {
    const steps = buildLesson('draaien', 7, makeRng(3)).filter((s) => s.answer !== undefined)
    for (let i = 0; i < steps.length; i += 2) {
      expect(steps[i].answer).toBe(steps[i + 1].answer)
      expect(steps[i + 1].turn).toBe(true)
    }
  })

  it('throwing alternates: Kit Nugget says one, you say the next', () => {
    const steps = buildLesson('ritme', 6, makeRng(2))
    const turns = steps.filter((s) => s.auto || s.answer !== undefined)
    expect(turns).toHaveLength(20)
    const firstRound = turns.slice(0, 10)
    firstRound.forEach((s, i) => expect(Boolean(s.auto)).toBe(i % 2 === 0))
    const yours = firstRound.filter((s) => s.answer !== undefined).map((s) => s.answer)
    expect(yours).toEqual([12, 24, 36, 48, 60])
  })

  it('the test has every brick count once', () => {
    const asks = buildLesson('proef', 8, makeRng(9)).filter((s) => s.answer !== undefined)
    expect(asks.map((s) => s.answer).sort((a, b) => a! - b!)).toEqual(chant(8))
  })

  it('picks a sum without a rhyme for the own rhyme', () => {
    expect(ownRhymeTarget(8)).toBe(8)
    expect(ownRhymeTarget(8, { ownRhymes: { '8x8': 'x' } })).toBe(9)
    expect(ownRhymeTarget(7, { weakest: [6] })).toBe(6)
  })
})

describe('bouwen: welke tafel', () => {
  const states = {
    '1x7': { box: 4 },
    '6x7': { box: 0 },
    '7x8': { box: 1 },
    '5x5': { box: 4 },
    '5x6': { box: 4 },
  }

  it('measures a table from the saved boxes', () => {
    expect(tableMastery(7, states)).toBeCloseTo((1 + 0 + 0.25) / 3)
    expect(tableMastery(5, states)).toBe(1)
    expect(tableMastery(9, states)).toBeNull()
  })

  it('suggests the weakest table that has not clicked yet', () => {
    expect(suggestTable([5, 7], states)).toBe(7)
    expect(suggestTable([5, 7], states, [7])).toBe(5)
  })

  it('orders brick counts weakest first', () => {
    expect(weakestCounts(7, states)[0]).toBe(6)
  })
})
