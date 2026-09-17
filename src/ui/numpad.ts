import { el } from './dom'

export interface NumpadHandlers {
  onDigit: (digit: number) => void
  onClear: () => void
  onOk: () => void
}

/** Big on-screen keypad. The physical keyboard is wired up alongside it. */
export class Numpad {
  readonly root: HTMLElement
  private handlers: NumpadHandlers
  private keyListener: (e: KeyboardEvent) => void

  constructor(handlers: NumpadHandlers) {
    this.handlers = handlers
    const keys: HTMLElement[] = []
    for (let n = 1; n <= 9; n++) {
      keys.push(el('button.key', { type: 'button', onclick: () => this.handlers.onDigit(n) }, String(n)))
    }
    keys.push(el('button.key.util', { type: 'button', 'aria-label': 'Wissen', onclick: () => this.handlers.onClear() }, 'Wis'))
    keys.push(el('button.key', { type: 'button', onclick: () => this.handlers.onDigit(0) }, '0'))
    keys.push(el('button.key.ok', { type: 'button', onclick: () => this.handlers.onOk() }, 'OK'))
    this.root = el('div', { id: 'numpad' }, ...keys)

    this.keyListener = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key >= '0' && e.key <= '9') {
        this.handlers.onDigit(Number(e.key))
        e.preventDefault()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        this.handlers.onClear()
        e.preventDefault()
      } else if (e.key === 'Enter' || e.key === ' ') {
        this.handlers.onOk()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this.keyListener)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyListener)
  }
}
