import { ITEMS, itemsBetween } from '../content/items'
import { zoneAt } from '../content/zones'
import type { SceneEvent } from './events'

export const ROUND_LENGTH = 20
export const BIG_JUMP = 3
export const SMALL_STEP = 1
export const COMBO_EFFECT_AT = 3
export const COMBO_BONUS_AT = 5
export const COMBO_BONUS = 1

export type AnswerResult = 'fast' | 'slow' | 'wrong'

export interface RoundState {
  answered: number
  total: number
  combo: number
  bestCombo: number
  gain: number
  fast: number
  slow: number
  wrong: number
}

export function newRound(total = ROUND_LENGTH): RoundState {
  return { answered: 0, total, combo: 0, bestCombo: 0, gain: 0, fast: 0, slow: 0, wrong: 0 }
}

/** Metres for one answer, given the combo level *after* this answer. */
export function metresFor(result: AnswerResult, comboAfter: number): number {
  if (result === 'wrong') return 0
  if (result === 'slow') return SMALL_STEP
  return BIG_JUMP + (comboAfter >= COMBO_BONUS_AT ? COMBO_BONUS : 0)
}

export interface StepOutcome {
  metres: number
  events: SceneEvent[]
  roundDone: boolean
}

/**
 * Applies one answer to the round and to the cumulative height.
 * `collected` is mutated with any newly picked up item ids.
 */
export function applyAnswer(
  round: RoundState,
  result: AnswerResult,
  heightBefore: number,
  collected: Set<string>,
): StepOutcome {
  const events: SceneEvent[] = []

  if (result === 'fast') {
    round.combo += 1
    round.fast += 1
  } else {
    round.combo = 0
    if (result === 'slow') round.slow += 1
    else round.wrong += 1
  }
  round.bestCombo = Math.max(round.bestCombo, round.combo)

  const metres = metresFor(result, round.combo)
  round.gain += metres
  round.answered += 1

  if (result === 'fast') events.push({ type: 'bigJump', metres })
  else if (result === 'slow') events.push({ type: 'smallStep', metres })
  else events.push({ type: 'stay' })

  if (round.combo >= COMBO_EFFECT_AT) events.push({ type: 'combo', n: round.combo })

  const heightAfter = heightBefore + metres
  if (metres > 0) {
    for (const item of itemsBetween(heightBefore, heightAfter)) {
      if (!collected.has(item.id)) {
        collected.add(item.id)
        events.push({ type: 'itemCollected', id: item.id })
      }
    }
    const zoneBefore = zoneAt(heightBefore)
    const zoneAfter = zoneAt(heightAfter)
    if (zoneAfter.id !== zoneBefore.id) events.push({ type: 'zoneChanged', id: zoneAfter.id })
  }

  const roundDone = round.answered >= round.total
  if (roundDone) events.push({ type: 'roundEnd' })

  return { metres, events, roundDone }
}

/** Items already earned at this height, for repairing an out-of-sync save. */
export function itemsUpTo(height: number): string[] {
  return ITEMS.filter((it) => it.height <= height).map((it) => it.id)
}
