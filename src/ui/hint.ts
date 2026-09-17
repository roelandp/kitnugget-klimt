import { hintFor } from '../content/hints'
import { el, clear } from './dom'

/**
 * The steunsom sheet. It slides up after a wrong answer, walks through the
 * strategy one step at a time and asks for the right answer once more. Nothing
 * here scores; it is there to leave the right route behind.
 */
export class HintSheet {
  readonly root: HTMLElement
  private sheet: HTMLElement
  private tip: HTMLElement
  private steps: HTMLElement
  private extra: HTMLElement
  private ask: HTMLElement
  private timers: number[] = []

  constructor() {
    this.tip = el('div.tip')
    this.steps = el('div.steps')
    this.extra = el('div.extra')
    this.ask = el('div.ask')
    this.sheet = el('div.sheet', {}, this.tip, this.steps, this.extra, this.ask)
    this.root = el('div', { id: 'hint' }, this.sheet)
  }

  get visible(): boolean {
    return this.root.classList.contains('show')
  }

  show(a: number, b: number): void {
    const hint = hintFor(a, b)
    this.clearTimers()
    this.tip.textContent = hint.tip
    clear(this.steps)
    this.extra.textContent = hint.extra ?? ''
    this.ask.textContent = `Typ het goede antwoord: ${a} x ${b} = ?`
    hint.steps.forEach((step, i) => {
      if (i > 0) this.steps.appendChild(el('span.step.eq', { text: '=' }))
      const node = el('span.step', { text: step })
      this.steps.appendChild(node)
    })
    const nodes = Array.from(this.steps.querySelectorAll('.step'))
    nodes.forEach((node, i) => {
      this.timers.push(
        window.setTimeout(() => node.classList.add('in'), 120 + i * 260),
      )
    })
    this.root.classList.add('show')
  }

  hide(): void {
    this.clearTimers()
    this.root.classList.remove('show')
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
  }
}
