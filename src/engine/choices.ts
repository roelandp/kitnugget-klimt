import type { Rng } from './rng'

/**
 * Generates 3 unique answer choices for `a * b`, exactly one of which is correct.
 * Distractors are drawn from realistic multiplication errors (adjacent table items,
 * neighbor multipliers, calculation slips, digit swaps).
 * The resulting 3 choices are shuffled.
 */
export function generateChoices(a: number, b: number, rng?: Rng): number[] {
  const correct = a * b
  const rand = rng ? () => rng.next() : Math.random

  const candidates: number[] = []

  // 1. Neighbour multipliers in table a
  candidates.push(a * (b + 1))
  if (b > 1) candidates.push(a * (b - 1))
  candidates.push(a * (b + 2))
  if (b > 2) candidates.push(a * (b - 2))

  // 2. Adjacent tables for multiplier b
  candidates.push((a + 1) * b)
  if (a > 1) candidates.push((a - 1) * b)
  candidates.push((a + 2) * b)
  if (a > 2) candidates.push((a - 2) * b)

  // 3. Digit swap if 2-digit number (e.g. 54 -> 45, 63 -> 36, 42 -> 24)
  if (correct >= 10 && correct <= 99) {
    const tens = Math.floor(correct / 10)
    const ones = correct % 10
    const swapped = ones * 10 + tens
    if (swapped !== correct && swapped > 0) {
      candidates.push(swapped)
    }
  }

  // 4. Common calculation slips (+/- 10, +/- 2, +/- 5, +/- 1)
  candidates.push(correct + 10)
  if (correct > 10) candidates.push(correct - 10)
  candidates.push(correct + 2)
  if (correct > 2) candidates.push(correct - 2)
  candidates.push(correct + 5)
  if (correct > 5) candidates.push(correct - 5)
  candidates.push(correct + 1)
  if (correct > 1) candidates.push(correct - 1)

  // Filter unique valid distractors (> 0 and !== correct)
  const validPool = Array.from(new Set(candidates.filter((c) => c > 0 && c !== correct)))

  // In the rare case where validPool has fewer than 2 items, generate fallbacks
  let offset = 3
  while (validPool.length < 2) {
    if (correct + offset > 0 && !validPool.includes(correct + offset)) {
      validPool.push(correct + offset)
    }
    if (correct - offset > 0 && correct - offset !== correct && !validPool.includes(correct - offset)) {
      validPool.push(correct - offset)
    }
    offset++
  }

  // Shuffle pool using Fisher-Yates and pick 2
  for (let i = validPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = validPool[i]
    validPool[i] = validPool[j]
    validPool[j] = temp
  }

  const choices = [correct, validPool[0], validPool[1]]

  // Shuffle the 3 choices
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = choices[i]
    choices[i] = choices[j]
    choices[j] = temp
  }

  return choices
}
