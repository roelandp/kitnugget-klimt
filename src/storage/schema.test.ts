import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, emptyProfile, emptySave, migrate } from './schema'

describe('storage migration', () => {
  it('returns a fresh save for junk', () => {
    expect(migrate(null).schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrate('nope').profiles.viggo.totalHeight).toBe(0)
    expect(migrate(42).activeProfile).toBe('viggo')
  })

  it('keeps known fields and fills in missing ones', () => {
    const old = { activeProfile: 'viggo', profiles: { viggo: { totalHeight: 123, bestRound: 40 } } }
    const out = migrate(old)
    expect(out.profiles.viggo.totalHeight).toBe(123)
    expect(out.profiles.viggo.bestRound).toBe(40)
    expect(out.profiles.viggo.settings.tables).toEqual([5, 6, 7, 8, 9])
    expect(out.profiles.viggo.settings.inputMode).toBe('keuze')
    expect(out.profiles.viggo.collected).toEqual([])
  })

  it('preserves open inputMode if specified', () => {
    const old = { profiles: { viggo: { settings: { inputMode: 'open' } } } }
    const out = migrate(old)
    expect(out.profiles.viggo.settings.inputMode).toBe('open')
  })

  it('caps the stored test history at 10', () => {
    const tests = Array.from({ length: 25 }, (_, i) => ({ at: i, tables: [5], count: 1, seconds: 1, correct: 1, wrong: [], skipped: [] }))
    const out = migrate({ profiles: { viggo: { ...emptyProfile(), tests } } })
    expect(out.profiles.viggo.tests.length).toBe(10)
    expect(out.profiles.viggo.tests[0].at).toBe(15)
  })

  it('round-trips a full save', () => {
    const save = emptySave()
    save.profiles.viggo.totalHeight = 321
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })
})
