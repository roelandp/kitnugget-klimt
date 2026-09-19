import type { Hint } from '../content/hints'
import { el, clear } from './dom'

/**
 * The steunsom sheet. It slides up after a wrong answer and walks through the
 * intermediate and final steps of the strategy interactively.
 */
export class HintSheet {
  readonly root: HTMLElement
  private sheet: HTMLElement
  private tip: HTMLElement
  private summary: HTMLElement
  private extra: HTMLElement
  private stepsWrap: HTMLElement
  private step1El: HTMLElement | null = null
  private step2El: HTMLElement | null = null
  private currentHint: Hint | null = null

  constructor() {
    this.tip = el('div.tip')
    this.summary = el('div.hint-summary')
    this.stepsWrap = el('div.hint-steps-wrap')
    this.extra = el('div.extra')
    this.sheet = el('div.sheet', {}, this.tip, this.summary, this.stepsWrap, this.extra)
    this.root = el('div', { id: 'hint' }, this.sheet)
  }

  get visible(): boolean {
    return this.root.classList.contains('show')
  }

  show(hint: Hint, currentStep: 1 | 2 = 1): void {
    this.currentHint = hint
    this.tip.textContent = `💡 ${hint.tip}`
    this.extra.textContent = hint.extra ?? ''
    clear(this.stepsWrap)

    const breakdown = hint.breakdown
    if (breakdown) {
      this.summary.textContent = breakdown.summary
      this.summary.style.display = 'block'

      if (breakdown.intermediate) {
        // 2-step breakdown
        this.step1El = el(
          'div.hint-step-card',
          { class: currentStep === 1 ? 'active' : 'done' },
          el('div.step-header', {}, el('span.step-badge', { text: 'Stap 1: Tussenstap' }), el('span.step-status', { text: currentStep === 1 ? '👉 Reken uit' : '✓ Klaar' })),
          el('div.step-prompt', { text: breakdown.intermediate.prompt }),
        )

        this.step2El = el(
          'div.hint-step-card',
          { class: currentStep === 2 ? 'active' : 'pending' },
          el('div.step-header', {}, el('span.step-badge', { text: 'Stap 2: Eindoplossing' }), el('span.step-status', { text: currentStep === 2 ? '👉 Reken uit' : 'Hierna' })),
          el('div.step-prompt', { text: breakdown.finalStep.prompt }),
        )

        this.stepsWrap.appendChild(this.step1El)
        this.stepsWrap.appendChild(this.step2El)
      } else {
        // 1-step breakdown
        this.step1El = el(
          'div.hint-step-card.active',
          {},
          el('div.step-header', {}, el('span.step-badge', { text: 'Oplossing' }), el('span.step-status', { text: '👉 Reken uit' })),
          el('div.step-prompt', { text: breakdown.finalStep.prompt }),
        )
        this.step2El = null
        this.stepsWrap.appendChild(this.step1El)
      }
    } else {
      this.summary.style.display = 'none'
    }

    this.root.classList.add('show')
  }

  setStep(step: 1 | 2): void {
    if (step === 2 && this.step2El && this.step1El && this.currentHint?.breakdown) {
      this.step1El.className = 'hint-step-card done'
      const status1 = this.step1El.querySelector('.step-status')
      if (status1) status1.textContent = '✓ Klaar'

      this.step2El.className = 'hint-step-card active'
      const status2 = this.step2El.querySelector('.step-status')
      if (status2) status2.textContent = '👉 Nu deze'
    }
  }

  markStep1Done(answer: number): void {
    if (this.step1El) {
      this.step1El.className = 'hint-step-card done'
      const status = this.step1El.querySelector('.step-status')
      if (status) status.textContent = `✓ = ${answer}`
    }
  }

  markStep2Done(answer: number): void {
    const target = this.step2El ?? this.step1El
    if (target) {
      target.className = 'hint-step-card done'
      const status = target.querySelector('.step-status')
      if (status) status.textContent = `✓ = ${answer}`
    }
  }

  hide(): void {
    this.root.classList.remove('show')
  }
}
