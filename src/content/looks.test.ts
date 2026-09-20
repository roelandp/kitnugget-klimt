import { describe, expect, it } from 'vitest'
import { DRAWN_HATS } from '../scene/dressart'
import { ITEMS } from './items'
import { HATS, PATTERNS, hatById, hatUnlocked, patternUnlocked, sanitiseLook } from './looks'

describe('hats', () => {
  it('has art for every hat: an item sprite or a painter', () => {
    for (const hat of HATS) {
      if (hat.source === 'item') expect(ITEMS.map((i) => i.id)).toContain(hat.id)
      else expect(DRAWN_HATS[hat.id]).toBeTypeOf('function')
    }
  })

  it('unlocks an item hat by collecting the item, not by height', () => {
    const crown = hatById('crown')!
    expect(hatUnlocked(crown, [], 5000)).toBe(false)
    expect(hatUnlocked(crown, ['crown'], 0)).toBe(true)
  })

  it('unlocks a drawn hat on height alone', () => {
    const lama = hatById('lama')!
    expect(hatUnlocked(lama, [], lama.height - 1)).toBe(false)
    expect(hatUnlocked(lama, [], lama.height)).toBe(true)
  })

  it('puts the silly extras between the item heights, so there is always a next one', () => {
    const itemHeights = ITEMS.map((i) => i.height)
    for (const hat of HATS.filter((h) => h.source === 'draw')) {
      expect(itemHeights).not.toContain(hat.height)
      expect(hat.height).toBeLessThan(Math.max(...itemHeights))
    }
  })
})

describe('patterns', () => {
  it('gives one pattern away for free and keeps the rest for later', () => {
    expect(PATTERNS.filter((p) => p.height === 0).length).toBe(1)
    expect(patternUnlocked(PATTERNS[0], 0)).toBe(true)
    const zebra = PATTERNS.find((p) => p.id === 'zebra')!
    expect(patternUnlocked(zebra, zebra.height - 1)).toBe(false)
    expect(patternUnlocked(zebra, zebra.height)).toBe(true)
  })
})

describe('sanitiseLook', () => {
  it('drops what is no longer unlocked and keeps what is', () => {
    expect(sanitiseLook({ hats: ['crown'], pattern: 'luipaard', cape: null }, [], 0)).toEqual({ hats: [], pattern: null, cape: null })
    expect(sanitiseLook({ hats: ['crown'], pattern: 'tijger', cape: null }, ['crown'], 0)).toEqual({
      hats: ['crown'],
      cape: null,
      pattern: 'tijger',
    })
  })

  it('drops ids that do not exist any more', () => {
    expect(sanitiseLook({ hats: ['sombrero'], pattern: 'stippen', cape: null }, ['sombrero'], 9999)).toEqual({
      hats: [],
      cape: null,
      pattern: null,
    })
  })
})
