import { describe, expect, it } from 'vitest'
import { generateChoices } from './choices'
import { makeRng } from './rng'

describe('generateChoices', () => {
  it('generates 3 choices containing exactly 1 correct answer for all tables 1..10', () => {
    const rng = makeRng(12345)
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const choices = generateChoices(a, b, rng)
        const correct = a * b

        expect(choices.length).toBe(3)
        // All choices must be positive integers
        choices.forEach((c) => {
          expect(c).toBeGreaterThan(0)
          expect(Number.isInteger(c)).toBe(true)
        })
        // All choices must be unique
        const unique = new Set(choices)
        expect(unique.size).toBe(3)

        // Exactly one choice is the correct answer
        expect(choices.filter((c) => c === correct).length).toBe(1)
      }
    }
  })

  it('randomizes the position of the correct answer across multiple calls', () => {
    const rng = makeRng(42)
    const positions = [0, 0, 0]
    const a = 7
    const b = 8
    const correct = 56

    for (let i = 0; i < 300; i++) {
      const choices = generateChoices(a, b, rng)
      const idx = choices.indexOf(correct)
      expect(idx).toBeGreaterThanOrEqual(0)
      positions[idx]++
    }

    // Each position should be hit a substantial number of times (~100 times each)
    expect(positions[0]).toBeGreaterThan(50)
    expect(positions[1]).toBeGreaterThan(50)
    expect(positions[2]).toBeGreaterThan(50)
  })

  it('works without an explicit rng provided', () => {
    const choices = generateChoices(6, 7)
    expect(choices.length).toBe(3)
    expect(choices).toContain(42)
    const unique = new Set(choices)
    expect(unique.size).toBe(3)
  })
})
