import {
  RHYMES,
  chant,
  inWords,
  rhymeText,
  rhymesFor,
  route,
  routeTip,
  tricksFor,
  type LessonId,
  type PlateSpec,
} from '../content/bouw'
import type { Rng } from '../engine/rng'

/** One screenful of a lesson. A step with an `answer` waits for the number. */
export interface Step {
  /** Kit Nugget's line: the prompt in words. */
  say: string
  /** The sum or chain shown big above the keypad. */
  sum?: string
  answer?: number
  plate?: PlateSpec
  /** Show the plate the other way round first; a tap on "Draai" turns it into `plate`. */
  turn?: boolean
  /** Kit Nugget's own turn: shown, read aloud and then the lesson moves on by itself. */
  auto?: boolean
  /** Line after a correct answer. */
  after?: string
  /** Line after a wrong answer, before trying again. */
  help?: string
  /** On a wrong answer, walk this sum through its anchor route. */
  repair?: { n: number; t: number }
  /** Ask for an own rhyme for this sum (free text, can be skipped). */
  write?: { n: number; t: number }
  /** Text to read aloud when the step appears. */
  speak?: string
}

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function routeSteps(n: number, t: number, intro: boolean): Step[] {
  const steps = route(n, t)
  return steps.map((s, i) => ({
    say: intro && i === 0 ? `${n} x ${t} = ${inWords(n, t)}. ${s.say}` : s.say,
    sum: s.sum,
    answer: s.answer,
    plate: s.plate,
    help: routeTip(n, t),
    after: i === steps.length - 1 ? `Dus ${n} x ${t} = ${n * t}!` : undefined,
  }))
}

export interface LessonOptions {
  /** Group counts n for this table, weakest first, from the saved statistics. */
  weakest?: number[]
  /** Facts that already have an own rhyme, as "nxt". */
  ownRhymes?: Record<string, string>
}

export function buildLesson(id: LessonId, t: number, rng: Rng, opts: LessonOptions = {}): Step[] {
  switch (id) {
    case 'stenen': {
      const intro: Step = {
        say: `Keer betekent: stenen van. ${3} x ${t} is ${inWords(3, t)}.`,
        sum: `3 x ${t}`,
        plate: { rows: 3, cols: t, labels: 'all' },
        speak: `Keer betekent: stenen van. 3 keer ${t} is 3 stenen van ${t} nopjes.`,
      }
      const asks = [2, 3, 5, 4, 6].map<Step>((n) => ({
        say: `${inWords(n, t)}. Tik de stenen om mee te tellen.`,
        sum: `${n} x ${t}`,
        answer: n * t,
        plate: { rows: n, cols: t, labels: 'tap' },
        help: `Tel per steen: ${t}, ${2 * t}, ${3 * t}...`,
        after: `${n} stenen van ${t} = ${n * t} nopjes.`,
      }))
      return [intro, ...asks]
    }

    case 'draaien': {
      const out: Step[] = [
        {
          say: 'Een plaat met nopjes kun je draaien. Er komen geen nopjes bij en er gaan er geen af.',
          plate: { rows: 3, cols: 4, labels: 'none', keepShape: true },
        },
      ]
      // Pairs where the swap clearly changes the picture.
      const counts = shuffle(rng, [2, 3, 4, 6].filter((n) => n !== t)).slice(0, 3)
      for (const n of counts) {
        out.push({
          say: `${inWords(n, t)}. Hoeveel nopjes?`,
          sum: `${n} x ${t}`,
          answer: n * t,
          plate: { rows: n, cols: t, labels: 'tap', keepShape: true },
          help: `Tel per steen: ${t}, ${2 * t}...`,
        })
        out.push({
          say: `Draai de plaat! Nu zijn het ${inWords(t, n)}. Hoeveel nopjes?`,
          sum: `${t} x ${n}`,
          answer: n * t,
          plate: { rows: t, cols: n, labels: 'none', keepShape: true, turned: true },
          turn: true,
          help: 'Draaien verandert niks aan het aantal nopjes.',
          after: `Evenveel! ${n} x ${t} = ${t} x ${n}. Dat scheelt de helft van het leren.`,
        })
      }
      return out
    }

    case 'ankers': {
      const intro: Step = {
        say: 'Ankers zijn sommen die je makkelijk kunt bouwen: 1, 2, 5 en 10 stenen. Daar begin je altijd.',
        plate: { rows: 10, cols: t, lit: 5, split: 5, labels: 'none' },
        speak: 'Ankers zijn sommen die je makkelijk kunt bouwen. 1, 2, 5 en 10 stenen.',
      }
      const out: Step[] = [intro]
      for (const n of [1, 2, 10, 5]) out.push(...routeSteps(n, t, true))
      for (const n of shuffle(rng, [2, 5, 10])) {
        out.push({
          say: `Weet je hem nu meteen? ${inWords(n, t)}.`,
          sum: `${n} x ${t}`,
          answer: n * t,
          plate: { rows: n, cols: t, lit: n, labels: 'none' },
          repair: { n, t },
          help: routeTip(n, t),
        })
      }
      return out
    }

    case 'slim': {
      const out: Step[] = [
        {
          say: `De lastige sommen bouw je vanuit een anker. 6 stenen is 5 stenen en nog 1. 9 stenen is 10 stenen min 1.`,
          plate: { rows: 6, cols: t, lit: 5, labels: 'none' },
        },
      ]
      for (const n of [6, 9, 4, 3, 7, 8]) out.push(...routeSteps(n, t, true))
      return out
    }

    case 'ritme': {
      // Throwing the ball back and forth: Kit Nugget says one, you say the next.
      const row = chant(t)
      const out: Step[] = [
        {
          say: `We gooien het bolletje wol over. Ik zeg ${t}, jij zegt de volgende. Steeds een steen van ${t} erbij.`,
          plate: { rows: 1, cols: t, labels: 'all' },
        },
      ]
      for (const youStart of [false, true]) {
        if (youStart) out.push({ say: 'Nu andersom: jij begint!', plate: { rows: 0, cols: t, labels: 'all' } })
        row.forEach((value, i) => {
          const yours = (i % 2 === 0) === youStart
          const plate: PlateSpec = { rows: i + 1, cols: t, labels: 'all' }
          if (yours) {
            out.push({
              say: i === 0 ? `Jij! Hoeveel is 1 steen van ${t}?` : `${row[i - 1]} en nog ${t} erbij?`,
              sum: i === 0 ? `1 x ${t}` : `${row[i - 1]} + ${t}`,
              answer: value,
              plate: { ...plate, hideLast: true },
              help: i === 0 ? `1 steen van ${t} is ${t}.` : `Tel ${t} bij ${row[i - 1]} op.`,
            })
          } else {
            out.push({ say: `🧶 ${value}!`, auto: true, plate, speak: String(value) })
          }
        })
      }
      return out
    }

    case 'rijm': {
      const out: Step[] = tricksFor(t).map((line) => ({ say: line, speak: line }))
      for (const r of shuffle(rng, rhymesFor(t))) {
        out.push({
          say: rhymeText(r, true),
          sum: `${r.n} x ${r.t}`,
          answer: r.n * r.t,
          help: rhymeText(r),
          after: rhymeText(r),
          speak: rhymeText(r, true).replace('___', 'hoeveel'),
        })
      }
      const row = chant(t)
      const gaps = shuffle(rng, [2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort((a, b) => a - b)
      for (const g of gaps) {
        const shown = row.slice(0, g + 1).map((v, i) => (i === g ? '?' : String(v)))
        out.push({
          say: 'Zeg het rijtje hardop en vul aan.',
          sum: shown.slice(-4).join('  '),
          answer: row[g],
          plate: { rows: g + 1, cols: t, labels: 'all', hideLast: true },
          help: `Steeds ${t} erbij.`,
        })
      }
      const own = ownRhymeTarget(t, opts)
      if (own !== null) out.push({ say: `Verzin je eigen rijmpje voor ${own} x ${t} = ${own * t}.`, write: { n: own, t } })
      return out
    }

    case 'proef': {
      const ns = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      return [
        { say: 'Bouwproef: alle stenen door elkaar. Geen klok, denk rustig na. Weet je het niet? Dan bouwen we hem samen.' },
        ...ns.map<Step>((n) => ({
          say: inWords(n, t),
          sum: `${n} x ${t}`,
          answer: n * t,
          repair: { n, t },
          help: routeTip(n, t),
        })),
      ]
    }
  }
}

/** The sum that most needs an own rhyme: weakest first, skipping ones that have a rhyme already. */
export function ownRhymeTarget(t: number, opts: LessonOptions = {}): number | null {
  const order = [...(opts.weakest ?? []), 7, 8, 6, 9, 4, 3]
  const taken = new Set(RHYMES.flatMap((r) => [`${r.n}x${r.t}`, `${r.t}x${r.n}`]))
  for (const n of order) {
    if (n < 3 || n === 5 || n === 10) continue
    const key = `${n}x${t}`
    if (taken.has(key) || opts.ownRhymes?.[key]) continue
    return n
  }
  return null
}

/** Number of steps that ask for an answer. */
export function questionCount(steps: Step[]): number {
  return steps.filter((s) => s.answer !== undefined).length
}

// ---------- knowledge per table, from the Leitner statistics ----------

interface BoxLike {
  box: number
}

function normalised(n: number, t: number): string {
  return `${Math.min(n, t)}x${Math.max(n, t)}`
}

/** 0..1 average box over the sums of table t that have been played, null when none were. */
export function tableMastery(t: number, states: Record<string, BoxLike | undefined>): number | null {
  let sum = 0
  let count = 0
  for (let n = 1; n <= 10; n++) {
    const s = states[normalised(n, t)]
    if (!s) continue
    sum += Math.max(0, Math.min(4, s.box)) / 4
    count += 1
  }
  return count === 0 ? null : sum / count
}

/** Group counts for table t, weakest first. */
export function weakestCounts(t: number, states: Record<string, BoxLike | undefined>): number[] {
  const list: { n: number; box: number }[] = []
  for (let n = 1; n <= 10; n++) {
    const s = states[normalised(n, t)]
    list.push({ n, box: s ? s.box : 2 })
  }
  return list.sort((a, b) => a.box - b.box || b.n - a.n).map((x) => x.n)
}

/** Table of the week: the weakest chosen table that has not clicked yet. */
export function suggestTable(
  tables: number[],
  states: Record<string, BoxLike | undefined>,
  clicked: number[] = [],
): number {
  const pool = tables.filter((t) => !clicked.includes(t))
  const from = pool.length > 0 ? pool : tables
  let best = from[0] ?? 7
  let bestScore = Infinity
  for (const t of from) {
    const score = tableMastery(t, states) ?? 0.5
    if (score < bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}
