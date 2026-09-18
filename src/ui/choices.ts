import { el } from './dom'

export interface ChoicesHandlers {
  onSelect: (value: number) => void
}

/**
 * Multiple choice component showing 3 large, finger-friendly buttons.
 * Keyboard keys 1, 2, and 3 also pick choice 1, 2, and 3.
 */
export class Choices {
  readonly root: HTMLElement
  private buttons: HTMLButtonElement[] = []
  private currentValues: number[] = []
  private handlers: ChoicesHandlers
  private keyListener: (e: KeyboardEvent) => void
  private enabled = true

  constructor(handlers: ChoicesHandlers) {
    this.handlers = handlers
    this.buttons = [0, 1, 2].map((i) => {
      const btn = el('button.choice-btn', {
        type: 'button',
        'data-index': String(i),
        onclick: () => this.handleClick(i),
      }) as HTMLButtonElement
      return btn
    })

    this.root = el('div', { id: 'choices' }, ...this.buttons)

    this.keyListener = (e: KeyboardEvent) => {
      if (!this.enabled) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Keys 1, 2, 3 pick option 1, 2, 3
      if (e.key === '1' || e.code === 'Numpad1') {
        this.handleClick(0)
        e.preventDefault()
      } else if (e.key === '2' || e.code === 'Numpad2') {
        this.handleClick(1)
        e.preventDefault()
      } else if (e.key === '3' || e.code === 'Numpad3') {
        this.handleClick(2)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this.keyListener)
  }

  setChoices(options: number[]): void {
    this.currentValues = [...options]
    this.enabled = true
    this.buttons.forEach((btn, i) => {
      const val = options[i] ?? 0
      btn.textContent = String(val)
      btn.className = 'choice-btn'
      btn.disabled = false
      btn.setAttribute('aria-label', `Antwoord ${val}`)
    })
  }

  highlight(value: number, status: 'correct' | 'wrong'): void {
    const idx = this.currentValues.indexOf(value)
    if (idx < 0) return
    const btn = this.buttons[idx]
    btn.classList.add(status)
    if (status === 'wrong') {
      btn.classList.add('shake')
      window.setTimeout(() => {
        btn.classList.remove('shake')
        btn.classList.remove('wrong')
      }, 500)
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.buttons.forEach((btn) => {
      btn.disabled = !enabled
    })
  }

  private handleClick(index: number): void {
    if (!this.enabled) return
    const val = this.currentValues[index]
    if (val !== undefined) {
      this.handlers.onSelect(val)
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyListener)
  }
}
