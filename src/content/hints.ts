export interface Hint {
  /** Steps shown one after another, joined with "=" in the overlay. */
  steps: string[]
  /** Short strategy name, shown above the steps. */
  tip: string
  /** Optional extra line, e.g. the reversal rule. */
  extra?: string
}

/** Fixed texts for the sums that trip kids up most. */
const VAST: Record<string, Hint> = {
  '7x8': { steps: ['7 x 8', '5, 6, 7, 8', '56'], tip: 'Onthoud het rijtje 5, 6, 7, 8' },
  '8x7': { steps: ['8 x 7', '5, 6, 7, 8', '56'], tip: 'Onthoud het rijtje 5, 6, 7, 8' },
  '6x6': { steps: ['6 x 6', '36'], tip: 'Kwadraat, dit is een anker' },
  '7x7': { steps: ['7 x 7', '49'], tip: 'Kwadraat, dit is een anker' },
  '8x8': { steps: ['8 x 8', '64'], tip: 'Kwadraat, dit is een anker' },
  '9x9': { steps: ['9 x 9', '81'], tip: 'Kwadraat, dit is een anker' },
  '5x5': { steps: ['5 x 5', '25'], tip: 'Kwadraat, dit is een anker' },
}

/** Lower rank means the operand makes a better strategy anchor. */
const RANK: Record<number, number> = { 10: 0, 1: 1, 2: 2, 5: 3, 9: 4, 4: 5, 8: 6, 3: 7, 6: 8, 7: 9 }

function strategy(n: number, other: number): Hint | null {
  const p = n * other
  switch (n) {
    case 1:
      return { steps: [`${other} x 1`, `${p}`], tip: 'Keer 1 blijft hetzelfde' }
    case 10:
      return { steps: [`${other} x 10`, `${p}`], tip: 'Keer 10 is een nul erachter' }
    case 2:
      return { steps: [`${other} x 2`, `${other} + ${other}`, `${p}`], tip: 'Keer 2 is dubbel' }
    case 5:
      return {
        steps: [`${other} x 5`, `${other} x 10 : 2`, `${other * 10} : 2`, `${p}`],
        tip: 'Keer 5 is de helft van keer 10',
      }
    case 9:
      return {
        steps: [`${other} x 9`, `${other} x 10 - ${other}`, `${other * 10} - ${other}`, `${p}`],
        tip: 'Keer 9 is keer 10 min een keer',
      }
    case 6:
      return {
        steps: [`${other} x 6`, `${other} x 5 + ${other}`, `${other * 5} + ${other}`, `${p}`],
        tip: 'Keer 6 is keer 5 en dan nog een keer erbij',
      }
    case 7:
      return {
        steps: [`${other} x 7`, `${other} x 5 + ${other} x 2`, `${other * 5} + ${other * 2}`, `${p}`],
        tip: 'Keer 7 is keer 5 plus keer 2',
      }
    case 8:
      return {
        steps: [`${other} x 8`, `${other} + ${other} = ${other * 2}`, `${other * 2} + ${other * 2} = ${other * 4}`, `${other * 4} + ${other * 4} = ${p}`],
        tip: 'Keer 8 is verdubbelen, verdubbelen, verdubbelen',
      }
    case 4:
      return {
        steps: [`${other} x 4`, `${other * 2} + ${other * 2}`, `${p}`],
        tip: 'Keer 4 is dubbel en nog eens dubbel',
      }
    case 3:
      return {
        steps: [`${other} x 3`, `${other} x 2 + ${other}`, `${other * 2} + ${other}`, `${p}`],
        tip: 'Keer 3 is dubbel en nog een keer erbij',
      }
    default:
      return null
  }
}

export function hintFor(a: number, b: number): Hint {
  const vast = VAST[`${a}x${b}`]
  const reverse = a !== b ? `${a} x ${b} is hetzelfde als ${b} x ${a}` : undefined
  if (vast) return { ...vast, extra: reverse }

  // Use whichever operand gives the friendliest route.
  const anchor = (RANK[b] ?? 9) <= (RANK[a] ?? 9) ? b : a
  const other = anchor === b ? a : b
  const hint = strategy(anchor, other) ?? { steps: [`${a} x ${b}`, `${a * b}`], tip: 'Tel er stapjes bij' }
  // Always open with the sum exactly as it was asked.
  const asked = `${a} x ${b}`
  const steps = hint.steps[0] === asked ? hint.steps : [asked, ...hint.steps]
  return { ...hint, steps, extra: reverse }
}
