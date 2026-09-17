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
})
