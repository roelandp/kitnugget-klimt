/**
 * Content for the "Bouwen" variant: tables as Lego. A sum n x t is always read
 * as "n stenen van t nopjes", so the times sign turns into a picture. Every
 * hard sum is reasoned out from the anchors 1, 2, 5 and 10 instead of drilled.
 */

export type LessonId = 'stenen' | 'draaien' | 'ankers' | 'slim' | 'ritme' | 'rijm' | 'proef'

export interface LessonInfo {
  id: LessonId
  title: string
  blurb: string
  icon: string
}

/** The blurb for table t: "{t}" stands for the table. */
export function blurbFor(lesson: LessonInfo, t: number): string {
  return lesson.blurb.split('{t}').join(String(t))
}

export const LESSONS: LessonInfo[] = [
  { id: 'stenen', title: 'Wat is keer?', blurb: '3 x {t} is 3 stenen van {t} nopjes', icon: '🧱' },
  { id: 'draaien', title: 'Draai de plaat', blurb: '3 x {t} is net zoveel als {t} x 3', icon: '🔄' },
  { id: 'ankers', title: 'De ankers', blurb: '1, 2, 5 en 10 stenen', icon: '⚓' },
  { id: 'slim', title: 'Slim bouwen', blurb: 'Vanuit een anker naar de lastige', icon: '🧠' },
  { id: 'ritme', title: 'Overgooien', blurb: 'Om de beurt het rijtje', icon: '🧶' },
  { id: 'rijm', title: 'Rijm en trucjes', blurb: 'Taaltrucs die blijven hangen', icon: '🎵' },
  { id: 'proef', title: 'Bouwproef', blurb: 'Alles door elkaar, zonder klok', icon: '🏆' },
]

export function lessonById(id: string): LessonInfo | undefined {
  return LESSONS.find((l) => l.id === id)
}

/** What to draw: `rows` bricks of `cols` studs each. */
export interface PlateSpec {
  rows: number
  cols: number
  /** The first `lit` bricks are the anchor (blue). Bricks after them are the extra part (orange). */
  lit?: number
  /** The last `crossed` bricks are taken away again (faded, dashed). */
  crossed?: number
  /** Draw a gap after this many bricks, to show a half. */
  split?: number
  /** Running totals next to the bricks: 'tap' reveals them one tap at a time. */
  labels?: 'all' | 'tap' | 'none'
  /** Keep the label of the last brick hidden: that is the number being asked. */
  hideLast?: boolean
  /** Brick counts whose running total is written next to them, e.g. [5] puts 35 beside 5 bricks of 7. */
  mark?: number[]
  /** Never stack in two columns: the rectangle itself is the point. */
  keepShape?: boolean
  /** The plate was turned: colour by column, so each old brick now stands upright in its own colour. */
  turned?: boolean
}

export function steen(n: number): string {
  return n === 1 ? '1 steen' : `${n} stenen`
}

/** "6 stenen van 7 nopjes": the times sign as a picture. */
export function inWords(n: number, t: number): string {
  return `${steen(n)} van ${t} ${t === 1 ? 'nopje' : 'nopjes'}`
}

export interface RouteStep {
  say: string
  sum: string
  answer: number
  plate: PlateSpec
}

/**
 * How to reason out n x t from the anchors, counting in bricks of t.
 * Every route ends on the full product.
 */
export function route(n: number, t: number): RouteStep[] {
  const p = n * t
  const plate = (rows: number, extra: Partial<PlateSpec> = {}): PlateSpec => ({ rows, cols: t, labels: 'none', ...extra })
  switch (n) {
    case 1:
      return [{ say: `1 steen van ${t} is gewoon ${t}.`, sum: `1 x ${t}`, answer: p, plate: plate(1) }]
    case 2:
      return [{ say: `2 stenen is het dubbele: ${t} + ${t}.`, sum: `${t} + ${t}`, answer: p, plate: plate(2, { lit: 1 }) }]
    case 10:
      return [{ say: `10 stenen: zet een nul achter ${t}.`, sum: `10 x ${t}`, answer: p, plate: plate(10, { lit: 10 }) }]
    case 5:
      return [
        { say: `Eerst 10 stenen van ${t}. Zet een nul erachter.`, sum: `10 x ${t}`, answer: 10 * t, plate: plate(10, { lit: 10 }) },
        { say: `5 stenen is de helft van 10 stenen. Wat is de helft van ${10 * t}?`, sum: `${10 * t} : 2`, answer: p, plate: plate(10, { lit: 5, crossed: 5, split: 5, mark: [10] }) },
      ]
    case 3:
      return [
        { say: `Eerst het dubbele: 2 stenen van ${t}.`, sum: `${t} + ${t}`, answer: 2 * t, plate: plate(3, { lit: 2, crossed: 1 }) },
        { say: `En nog 1 steen van ${t} erbij.`, sum: `${2 * t} + ${t}`, answer: p, plate: plate(3, { lit: 2, mark: [2] }) },
      ]
    case 4:
      return [
        { say: `Eerst 2 stenen van ${t}: het dubbele.`, sum: `${t} + ${t}`, answer: 2 * t, plate: plate(4, { lit: 2, crossed: 2 }) },
        { say: `4 stenen is nog een keer dubbel.`, sum: `${2 * t} + ${2 * t}`, answer: p, plate: plate(4, { lit: 2, split: 2, mark: [2] }) },
      ]
    case 6:
      return [
        { say: `Begin bij het anker: 5 stenen van ${t}.`, sum: `5 x ${t}`, answer: 5 * t, plate: plate(6, { lit: 5, crossed: 1 }) },
        { say: `Nu nog 1 steen van ${t} erbij.`, sum: `${5 * t} + ${t}`, answer: p, plate: plate(6, { lit: 5, mark: [5] }) },
      ]
    case 7:
      return [
        { say: `Begin bij het anker: 5 stenen van ${t}.`, sum: `5 x ${t}`, answer: 5 * t, plate: plate(7, { lit: 5, crossed: 2 }) },
        { say: `Nu nog 2 stenen van ${t} erbij. Dat is ${2 * t}.`, sum: `${5 * t} + ${2 * t}`, answer: p, plate: plate(7, { lit: 5, mark: [5] }) },
      ]
    case 8:
      return [
        { say: `Verdubbelen! Eerst 2 stenen van ${t}.`, sum: `${t} + ${t}`, answer: 2 * t, plate: plate(8, { lit: 2, crossed: 6 }) },
        { say: `Verdubbel: 4 stenen.`, sum: `${2 * t} + ${2 * t}`, answer: 4 * t, plate: plate(8, { lit: 4, crossed: 4, split: 2, mark: [2] }) },
        { say: `Nog een keer verdubbelen: 8 stenen.`, sum: `${4 * t} + ${4 * t}`, answer: p, plate: plate(8, { lit: 4, split: 4, mark: [4] }) },
      ]
    case 9:
      return [
        { say: `Begin bij 10 stenen van ${t}. Nul erachter.`, sum: `10 x ${t}`, answer: 10 * t, plate: plate(10, { lit: 10 }) },
        { say: `9 stenen is 1 steen minder. Haal er ${t} af.`, sum: `${10 * t} - ${t}`, answer: p, plate: plate(10, { lit: 9, crossed: 1, mark: [10] }) },
      ]
    default:
      return [{ say: `Tel de stenen van ${t}.`, sum: `${n} x ${t}`, answer: p, plate: plate(n, { labels: 'tap' }) }]
  }
}

/** One line under the route, in words. */
export function routeTip(n: number, t: number): string {
  switch (n) {
    case 1:
      return 'Keer 1 blijft hetzelfde.'
    case 2:
      return 'Keer 2 is verdubbelen.'
    case 3:
      return 'Keer 3 is dubbel en nog 1 steen erbij.'
    case 4:
      return 'Keer 4 is dubbel en nog eens dubbel.'
    case 5:
      return 'Keer 5 is de helft van keer 10.'
    case 6:
      return 'Keer 6 is keer 5 en nog 1 steen erbij.'
    case 7:
      return 'Keer 7 is keer 5 en nog 2 stenen erbij.'
    case 8:
      return 'Keer 8 is verdubbelen, verdubbelen, verdubbelen.'
    case 9:
      return 'Keer 9 is keer 10 en dan 1 steen eraf.'
    case 10:
      return 'Keer 10 is een nul erachter.'
    default:
      return `${n} x ${t} = ${n * t}`
  }
}

export interface Rhyme {
  n: number
  t: number
  /** Text before the answer. */
  before: string
  /** Text after the answer. */
  after: string
}

/** Rhymes and number tricks for the known stumbling blocks. */
export const RHYMES: Rhyme[] = [
  { n: 6, t: 6, before: 'Zes keer zes is', after: ', gooi de schillen in het vuurtig!' },
  { n: 6, t: 8, before: 'Zes keer acht is', after: ', vind je dat niet reuze prachtig?' },
  { n: 7, t: 8, before: 'Zet ze op een rij: 5, 6, 7, 8. Zeven keer acht is', after: '.' },
  { n: 7, t: 7, before: 'Zeven keer zeven is', after: ', Kit Nugget klimt en vindt het prachtig.' },
  { n: 9, t: 9, before: 'Negen keer negen is', after: ', Kit Nugget is moe maar nog steeds krachtig.' },
  { n: 3, t: 4, before: 'Tel maar mee: 1, 2, 3, 4. Drie keer vier is', after: '.' },
]

export function rhymeText(r: Rhyme, gap = false): string {
  return `${r.before} ${gap ? '___' : String(r.n * r.t)}${r.after}`
}

/** Rhymes that belong to table t, in either order. */
export function rhymesFor(t: number): Rhyme[] {
  return RHYMES.filter((r) => r.n === t || r.t === t)
}

/** Number tricks per table. Each one is true for the whole table, or says where it holds. */
export function tricksFor(t: number): string[] {
  const out: string[] = []
  switch (t) {
    case 2:
      out.push('Keer 2 is verdubbelen: 7 + 7 = 14.')
      break
    case 3:
      out.push('Dubbel en nog 1 steen erbij: 3 x 6 = 12 + 6 = 18.')
      out.push('Tel 1, 2, 3, 4: dan weet je 12 = 3 x 4.')
      break
    case 4:
      out.push('Dubbel en nog eens dubbel: 4 x 7 = 14 + 14 = 28.')
      out.push('Alles in de tafel van 4 is een even getal.')
      break
    case 5:
      out.push('Alles in de tafel van 5 eindigt op een 5 of een 0.')
      out.push('5 stenen is de helft van 10 stenen: 10 x 8 = 80, de helft is 40.')
      break
    case 6:
      out.push('Bij 2, 4, 6 en 8 stenen staat het aantal stenen achteraan: 4 x 6 = 24, 8 x 6 = 48.')
      out.push('En vooraan staat de helft: 8 x 6, de helft van 8 is 4, dus 48.')
      break
    case 7:
      out.push('Keer 7 is keer 5 plus keer 2: 6 x 7 = 30 + 12 = 42.')
      out.push('Het lastige rijtje: 5, 6, 7, 8 betekent 56 = 7 x 8.')
      break
    case 8:
      out.push('Verdubbelen, verdubbelen, verdubbelen: 8, 16, 32, 64 voor 1, 2, 4 en 8 stenen.')
      out.push('Alles in de tafel van 8 is een even getal.')
      break
    case 9:
      out.push('Het tiental is 1 minder dan het aantal stenen: 7 x 9 begint met een 6.')
      out.push('De twee cijfers maken samen 9: 6 + 3 = 9, dus 7 x 9 = 63.')
      break
    case 10:
      out.push('Keer 10 is een nul erachter: 10 x 7 = 70.')
      break
    default:
      break
  }
  out.push(`Draai om mag altijd: 3 x ${t} is net zoveel als ${t} x 3.`)
  return out
}

/** The table as a chant: t, 2t, ... 10t. */
export function chant(t: number): number[] {
  return Array.from({ length: 10 }, (_, i) => (i + 1) * t)
}

/** Readable labels for the overall knowledge of a table, from 0..1. */
export function masteryLabel(score: number | null): string {
  if (score === null) return 'nog niet geoefend'
  if (score >= 0.75) return 'gaat al goed'
  if (score >= 0.45) return 'op weg'
  return 'hier zit de knoop'
}
