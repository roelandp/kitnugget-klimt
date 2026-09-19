import { generateChoices } from '../engine/choices'

export interface StrategyStep {
  prompt: string
  formula: string
  answer: number
  choices: number[]
}

export interface HintBreakdown {
  summary: string
  intermediate?: StrategyStep
  finalStep: StrategyStep
}

export interface Hint {
  /** Steps shown one after another, joined with "=" in the overlay. */
  steps: string[]
  /** Short strategy name, shown above the steps. */
  tip: string
  /** Optional extra line, e.g. the reversal rule. */
  extra?: string
  /** Interactive step-by-step breakdown */
  breakdown?: HintBreakdown
}

function makeArithmeticChoices(answer: number): number[] {
  const distractors = [
    answer + 2,
    answer - 2,
    answer + 10,
    answer - 10,
    answer + 1,
    answer - 1,
    answer + 5,
    answer - 5,
  ].filter((x) => x > 0 && x !== answer)
  const unique = Array.from(new Set(distractors))
  const d1 = unique[0] ?? (answer + 2)
  const d2 = unique[1] ?? (answer + 4)
  const choices = [answer, d1, d2]
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = choices[i]
    choices[i] = choices[j]
    choices[j] = temp
  }
  return choices
}

function breakdownFor(a: number, b: number, anchor: number, other: number): HintBreakdown {
  const p = a * b

  // 7x8 / 8x7 special friendly route
  if ((a === 7 && b === 8) || (a === 8 && b === 7)) {
    return {
      summary: '7 x 8 = 5 x 8 + 2 x 8',
      intermediate: {
        prompt: 'Reken eerst de tussenstap uit: 5 x 8',
        formula: '5 x 8',
        answer: 40,
        choices: generateChoices(5, 8),
      },
      finalStep: {
        prompt: 'Tel er nu nog 2 x 8 (16) bij op: 40 + 16',
        formula: '40 + 16',
        answer: 56,
        choices: generateChoices(7, 8),
      },
    }
  }

  switch (anchor) {
    case 6:
      return {
        summary: `${other} x 6 = 5 x ${other} + ${other}`,
        intermediate: {
          prompt: `Reken eerst de tussenstap uit: 5 x ${other}`,
          formula: `5 x ${other}`,
          answer: 5 * other,
          choices: generateChoices(5, other),
        },
        finalStep: {
          prompt: `Tel er nu nog ${other} bij op: ${5 * other} + ${other}`,
          formula: `${5 * other} + ${other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 9:
      return {
        summary: `${other} x 9 = 10 x ${other} - ${other}`,
        intermediate: {
          prompt: `Reken eerst de tussenstap uit: 10 x ${other}`,
          formula: `10 x ${other}`,
          answer: 10 * other,
          choices: makeArithmeticChoices(10 * other),
        },
        finalStep: {
          prompt: `Trek er nu ${other} van af: ${10 * other} - ${other}`,
          formula: `${10 * other} - ${other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 7:
      return {
        summary: `${other} x 7 = 5 x ${other} + 2 x ${other}`,
        intermediate: {
          prompt: `Reken eerst de tussenstap uit: 5 x ${other}`,
          formula: `5 x ${other}`,
          answer: 5 * other,
          choices: generateChoices(5, other),
        },
        finalStep: {
          prompt: `Tel er nu 2 x ${other} (${2 * other}) bij op: ${5 * other} + ${2 * other}`,
          formula: `${5 * other} + ${2 * other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 8:
      return {
        summary: `${other} x 8 = 4 x ${other} + 4 x ${other}`,
        intermediate: {
          prompt: `Reken eerst het dubbele uit: 4 x ${other}`,
          formula: `4 x ${other}`,
          answer: 4 * other,
          choices: generateChoices(4, other),
        },
        finalStep: {
          prompt: `Verdubbel dat antwoord: ${4 * other} + ${4 * other}`,
          formula: `${4 * other} + ${4 * other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 4:
      return {
        summary: `${other} x 4 = 2 x (2 x ${other})`,
        intermediate: {
          prompt: `Reken eerst het dubbele uit: 2 x ${other}`,
          formula: `2 x ${other}`,
          answer: 2 * other,
          choices: generateChoices(2, other),
        },
        finalStep: {
          prompt: `Verdubbel dat nog een keer: ${2 * other} + ${2 * other}`,
          formula: `${2 * other} + ${2 * other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 3:
      return {
        summary: `${other} x 3 = 2 x ${other} + ${other}`,
        intermediate: {
          prompt: `Reken eerst het dubbele uit: 2 x ${other}`,
          formula: `2 x ${other}`,
          answer: 2 * other,
          choices: generateChoices(2, other),
        },
        finalStep: {
          prompt: `Tel er nog een keer ${other} bij op: ${2 * other} + ${other}`,
          formula: `${2 * other} + ${other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 5:
      return {
        summary: `${other} x 5 = (${other} x 10) : 2`,
        intermediate: {
          prompt: `Reken eerst keer 10 uit: 10 x ${other}`,
          formula: `10 x ${other}`,
          answer: 10 * other,
          choices: makeArithmeticChoices(10 * other),
        },
        finalStep: {
          prompt: `Neem nu de helft: ${10 * other} : 2`,
          formula: `${10 * other} : 2`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    case 2:
      return {
        summary: `${other} x 2 = ${other} + ${other}`,
        finalStep: {
          prompt: `Tel ${other} bij zichzelf op: ${other} + ${other}`,
          formula: `${other} + ${other}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
    default:
      return {
        summary: `${a} x ${b} = ${p}`,
        finalStep: {
          prompt: `Wat is ${a} x ${b}?`,
          formula: `${a} x ${b}`,
          answer: p,
          choices: generateChoices(a, b),
        },
      }
  }
}

/** Fixed texts for the sums that trip kids up most. */
const VAST: Record<string, Omit<Hint, 'breakdown'>> = {
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

function strategy(n: number, other: number): Omit<Hint, 'breakdown'> | null {
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

  // Use whichever operand gives the friendliest route.
  const anchor = (RANK[b] ?? 9) <= (RANK[a] ?? 9) ? b : a
  const other = anchor === b ? a : b
  const breakdown = breakdownFor(a, b, anchor, other)

  if (vast) return { ...vast, breakdown, extra: reverse }

  const hint = strategy(anchor, other) ?? { steps: [`${a} x ${b}`, `${a * b}`], tip: 'Tel er stapjes bij' }
  // Always open with the sum exactly as it was asked.
  const asked = `${a} x ${b}`
  const steps = hint.steps[0] === asked ? hint.steps : [asked, ...hint.steps]
  return { ...hint, breakdown, steps, extra: reverse }
}
