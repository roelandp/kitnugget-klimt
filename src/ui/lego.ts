import type { PlateSpec } from '../content/bouw'
import { clear, el } from './dom'

/** Bright brick colours, cycled so neighbouring bricks are always different. */
const COLOURS = ['#e3402f', '#f5c518', '#2f7fd6', '#3aa655', '#f08a24', '#9b59b6']
const ANCHOR = '#2f7fd6'
const EXTRA = '#f08a24'
const MAX_STUD = 34
const GAP = 3
const LABEL_W = 34

/**
 * A Lego plate made of bricks: `rows` bricks of `cols` studs. A sum n x t is
 * n bricks of t, so the times sign becomes something you can see and count.
 * Anchor bricks are blue, the extra part orange, and bricks that are taken
 * away again stay as a dashed ghost.
 */
export class LegoPlate {
  readonly root: HTMLElement
  private plate: HTMLElement
  private spec: PlateSpec | null = null
  private revealed = 0
  private observer: ResizeObserver | null = null
  private turning = false
  /** Called with the running total each time a brick is counted. */
  onCount: ((total: number, index: number) => void) | null = null

  constructor() {
    this.plate = el('div.lego-plate')
    this.root = el('div.lego-wrap', {}, this.plate)
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => {
        if (!this.turning) this.draw()
      })
      this.observer.observe(this.root)
    }
  }

  render(spec: PlateSpec | null | undefined): void {
    this.spec = spec ?? null
    this.revealed = 0
    this.turning = false
    this.plate.style.transition = 'none'
    this.plate.style.transform = ''
    this.draw()
  }

  /** Shows `spec` turned a quarter, so that turn() brings it into place. */
  renderTurned(spec: PlateSpec): void {
    this.render({ ...spec, rows: spec.cols, cols: spec.rows, labels: 'none' })
    this.pending = spec
  }

  private pending: PlateSpec | null = null

  /** Animates the quarter turn, then redraws the plate the new way round. */
  turn(): Promise<void> {
    const target = this.pending
    this.pending = null
    if (!target) return Promise.resolve()
    this.turning = true
    return new Promise((resolve) => {
      this.plate.style.transition = 'transform 700ms cubic-bezier(0.5, 0, 0.3, 1.3)'
      this.plate.style.transform = 'rotate(90deg)'
      window.setTimeout(() => {
        this.render(target)
        this.plate.classList.add('settle')
        window.setTimeout(() => this.plate.classList.remove('settle'), 300)
        resolve()
      }, 720)
    })
  }

  /**
   * Stud size, and whether to stack the bricks in two columns. Two columns
   * follow the anchor where they can: 5 | 1 for six bricks, 4 | 4 for eight
   * when doubling. A plate that is about to be turned keeps its shape.
   */
  private layout(spec: PlateSpec): { s: number; perCol: number } {
    const w = this.root.clientWidth || 320
    const h = this.root.clientHeight || 200
    const rows = Math.max(1, spec.rows)
    const cols = Math.max(1, spec.cols)
    const splitGap = spec.split ? 10 : 0
    const single = Math.min((w - LABEL_W - 16) / cols, (h - 8 - splitGap - GAP * (rows - 1)) / rows)
    let best = { s: single, perCol: rows }
    if (rows > 5 && !spec.keepShape) {
      let perCol = spec.split ?? spec.lit ?? 5
      if (perCol > 5 || perCol < rows / 2) perCol = 5
      const two = Math.min((w - 2 * LABEL_W - 18 - 16) / (2 * cols), (h - 8 - GAP * (perCol - 1)) / perCol)
      if (two > single * 1.15) best = { s: two, perCol }
    }
    return { s: Math.max(8, Math.floor(Math.min(MAX_STUD, best.s))), perCol: best.perCol }
  }

  private colourOf(spec: PlateSpec, i: number): { colour: string; ghost: boolean } {
    const crossed = spec.crossed ?? 0
    if (i >= spec.rows - crossed) return { colour: 'transparent', ghost: true }
    if (spec.lit === undefined) return { colour: COLOURS[i % COLOURS.length], ghost: false }
    return { colour: i < spec.lit ? ANCHOR : EXTRA, ghost: false }
  }

  private draw(): void {
    clear(this.plate)
    const spec = this.spec
    if (!spec || spec.rows <= 0) return
    const { s, perCol } = this.layout(spec)
    const two = perCol < spec.rows
    this.plate.style.setProperty('--s', `${s}px`)
    this.plate.style.setProperty('--per', String(perCol))
    this.plate.classList.toggle('two', two)
    const crossed = spec.crossed ?? 0
    const labels = spec.labels ?? 'none'
    for (let i = 0; i < spec.rows; i++) {
      const { colour, ghost } = this.colourOf(spec, i)
      // A quarter turn clockwise puts the old top brick in the right-hand column.
      const studs = Array.from({ length: spec.cols }, (_, j) =>
        spec.turned ? el('i.stud', { style: { background: COLOURS[(spec.cols - 1 - j) % COLOURS.length] } }) : el('i.stud'),
      )
      const brick = el(
        'div.brick',
        { class: `${ghost ? 'ghost' : ''} ${spec.turned ? 'turned' : ''}`, style: { background: spec.turned ? 'transparent' : colour, width: `${spec.cols * s}px` } },
        ...studs,
      )
      let labelText = ''
      const isLast = i === spec.rows - 1
      if (!ghost && labels === 'all') labelText = isLast && spec.hideLast ? '?' : String((i + 1) * spec.cols)
      if (!ghost && labels === 'tap' && i < this.revealed) labelText = String((i + 1) * spec.cols)
      const marked = spec.mark?.includes(i + 1) ?? false
      if (marked && !labelText) labelText = String((i + 1) * spec.cols)
      const label = el('b.brick-label', { class: marked ? 'mark' : '', text: labelText })
      const row = el('div.brick-row', { class: spec.split === i && i > 0 && !(two && i === perCol) ? 'split' : '' }, brick, label)
      if (labels === 'tap' && !ghost) row.addEventListener('pointerdown', () => this.countNext())
      // A small stagger so the bricks look stacked on, not printed.
      row.style.animationDelay = `${Math.min(i, 10) * 35}ms`
      this.plate.appendChild(row)
    }
    if (labels === 'tap' && this.revealed < spec.rows - crossed) this.plate.classList.add('tappable')
    else this.plate.classList.remove('tappable')
  }

  /** Reveals the next running total: counting in bricks, 7, 14, 21. */
  countNext(): void {
    const spec = this.spec
    if (!spec || (spec.labels ?? 'none') !== 'tap') return
    const max = spec.rows - (spec.crossed ?? 0)
    if (this.revealed >= max) return
    this.revealed += 1
    const row = this.plate.children[this.revealed - 1] as HTMLElement | undefined
    const label = row?.querySelector('.brick-label')
    if (label) label.textContent = String(this.revealed * spec.cols)
    row?.classList.add('pop')
    if (this.revealed >= max) this.plate.classList.remove('tappable')
    this.onCount?.(this.revealed * spec.cols, this.revealed)
  }

  dispose(): void {
    this.observer?.disconnect()
  }
}
