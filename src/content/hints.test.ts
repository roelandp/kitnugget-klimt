import { describe, expect, it } from 'vitest'
import { hintFor } from './hints'

describe('steunsommen', () => {
  it('always opens with the sum as asked and ends on the answer', () => {
    for (const a of [5, 6, 7, 8, 9]) {
      for (let b = 1; b <= 10; b++) {
        const hint = hintFor(a, b)
        expect(hint.steps[0]).toBe(`${a} x ${b}`)
        expect(hint.steps[hint.steps.length - 1]).toContain(String(a * b))
        expect(hint.tip.length).toBeGreaterThan(3)
      }
    }
  })

  it('uses the fixed text for 7x8', () => {
    expect(hintFor(7, 8).steps).toContain('5, 6, 7, 8')
    expect(hintFor(8, 7).steps).toContain('5, 6, 7, 8')
  })

  it('treats squares as anchors', () => {
    for (const n of [6, 7, 8, 9]) expect(hintFor(n, n).tip).toContain('anker')
  })

  it('uses ten-minus-one for x9', () => {
    expect(hintFor(7, 9).steps.join(' ')).toContain('7 x 10 - 7')
  })

  it('uses half-of-ten for x5', () => {
    expect(hintFor(7, 5).steps.join(' ')).toContain('7 x 10 : 2')
  })

  it('offers the reversal for a non-square', () => {
    expect(hintFor(7, 3).extra).toBe('7 x 3 is hetzelfde als 3 x 7')
    expect(hintFor(7, 7).extra).toBeUndefined()
  })

  it('provides an interactive breakdown with intermediate step for 6x7', () => {
    const hint = hintFor(6, 7)
    expect(hint.breakdown).toBeDefined()
    expect(hint.breakdown!.intermediate).toBeDefined()
    expect(hint.breakdown!.intermediate!.answer).toBe(35)
    expect(hint.breakdown!.intermediate!.formula).toContain('5 x 7')
    expect(hint.breakdown!.finalStep.answer).toBe(42)
  })

  it('provides valid 3 choices for all steps across all tables', () => {
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const hint = hintFor(a, b)
        expect(hint.breakdown).toBeDefined()
        const { intermediate, finalStep } = hint.breakdown!
        if (intermediate) {
          expect(intermediate.choices.length).toBe(3)
          expect(intermediate.choices).toContain(intermediate.answer)
          expect(new Set(intermediate.choices).size).toBe(3)
        }
        expect(finalStep.choices.length).toBe(3)
        expect(finalStep.choices).toContain(finalStep.answer)
        expect(new Set(finalStep.choices).size).toBe(3)
      }
    }
  })
})
