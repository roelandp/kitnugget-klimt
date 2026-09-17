import type { App, Screen } from '../app'
import { ITEMS } from '../content/items'
import type { Engine, Selection } from '../engine/engine'
import type { SceneEvent } from '../game/events'
import { noteRound } from '../game/day'
import { ROUND_LENGTH, applyAnswer, newRound, type AnswerResult, type RoundState } from '../game/progress'
import { Scene } from '../scene/scene'
import { el, metres } from './dom'
import { HintSheet } from './hint'
import { Numpad } from './numpad'

export interface RoundSummary {
  round: RoundState
  totalHeight: number
  bestRound: number
  isRecord: boolean
  attention: { label: string; status: string }[]
  newItems: string[]
}

/**
 * One round of 20 sums. Kit Nugget only ever moves up: a fast answer is a jump,
 * a slow one is a step, and a wrong one keeps him where he is while the steunsom
 * comes out. Nothing here can make him fall.
 */
export function gameScreen(app: App): Screen {
  const engine: Engine = app.makeEngine()
  const round = newRound(ROUND_LENGTH)
  const collected = new Set(app.store.profile.collected)
  const newItems: string[] = []
  let height = app.store.profile.totalHeight
  const startHeight = height

  let selection: Selection | null = null
  let shownAt = 0
  let typed = ''
  let phase: 'answer' | 'repair' | 'settle' = 'answer'
  let timerHandle = 0

  // ---------- chrome ----------
  const canvas = el('canvas', { id: 'scene-canvas' }) as HTMLCanvasElement
  const heightPill = el('div.pill', {}, el('small', { text: 'Hoogte' }), el('span', { text: '0 m' }))
  const gainPill = el('div.pill', {}, el('small', { text: 'Deze ronde' }), el('span', { text: '0 m' }))
  const countPill = el('div.pill', {}, el('small', { text: 'Som' }), el('span', { text: `1/${ROUND_LENGTH}` }))
  const comboFlag = el('div', { id: 'combo-flag' })
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  ring.setAttribute('id', 'ring-timer')
  ring.setAttribute('viewBox', '0 0 40 40')
  ring.innerHTML =
    '<circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="5"/>' +
    '<circle id="ring-arc" cx="20" cy="20" r="16" fill="none" stroke="#ffd27d" stroke-width="5" stroke-linecap="round" transform="rotate(-90 20 20)"/>'
  const ringArc = ring.querySelector('#ring-arc') as SVGCircleElement
  const RING_LEN = 2 * Math.PI * 16
  ringArc.setAttribute('stroke-dasharray', String(RING_LEN))

  const quit = el('button.btn.small.ghost', { onclick: () => finish(true) }, 'Stop')
  const hud = el('div.hud', {}, heightPill, gainPill, countPill, el('div.spacer'), quit)
  const sceneWrap = el('div', { id: 'scene-wrap' }, canvas, hud, comboFlag, ring as unknown as HTMLElement)

  const sumText = el('div', { id: 'sum-text', text: '' })
  const answerBox = el('div', { id: 'answer-box', text: '' })
  const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox)

  const numpad = new Numpad({ onDigit: pressDigit, onClear: pressClear, onOk: pressOk })
  const panel = el('div', { id: 'panel' }, sumLine, numpad.root)
  const hint = new HintSheet()
  const root = el('div.screen', {}, sceneWrap, panel, hint.root)

  const scene = new Scene(canvas, app.assets)
  scene.setMouseStyle(app.store.profile.settings.timerStyle)
  scene.setCollected(collected)
  scene.setHeight(height)
  scene.onHeight = (m, parallax) => {
    app.backdrop.update(m, parallax)
    heightPill.lastElementChild!.textContent = `${metres(m)} m`
  }

  const onResize = () => scene.resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)

  requestAnimationFrame(() => {
    scene.resize()
    scene.start()
    app.backdrop.update(height, 0)
    emit({ type: 'roundStart' })
    next()
  })

  // ---------- flow ----------

  function emit(event: SceneEvent): void {
    scene.event(event)
    switch (event.type) {
      case 'bigJump':
        app.audio.play('jump')
        break
      case 'smallStep':
        app.audio.play('step')
        break
      case 'stay':
        app.audio.play('wrong')
        break
      case 'combo':
        app.audio.play('combo', event.n)
        flashCombo(event.n)
        break
      case 'itemCollected':
        app.audio.play('item')
        newItems.push(event.id)
        break
      case 'zoneChanged':
        app.audio.setZone(event.id)
        break
      case 'roundEnd':
        app.audio.play('roundEnd')
        break
      default:
        break
    }
  }

  function flashCombo(n: number): void {
    comboFlag.textContent = `Combo ${n}!`
    comboFlag.classList.add('show')
    window.setTimeout(() => comboFlag.classList.remove('show'), 900)
  }

  function next(): void {
    if (round.answered >= ROUND_LENGTH) return
    selection = engine.next()
    typed = ''
    phase = 'answer'
    answerBox.className = ''
    answerBox.textContent = ''
    sumText.textContent = `${selection.fact.a} x ${selection.fact.b}`
    countPill.lastElementChild!.textContent = `${round.answered + 1}/${ROUND_LENGTH}`
    shownAt = performance.now()
    startTimer(selection.limit)
  }

  function startTimer(limit: number): void {
    scene.startTimer(limit)
    if (app.store.profile.settings.timerStyle === 'ring') {
      ring.classList.add('show')
      const begin = performance.now()
      const step = () => {
        const p = Math.min(1, (performance.now() - begin) / (limit * 1000))
        ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p))
        if (p < 1 && phase === 'answer') timerHandle = requestAnimationFrame(step)
      }
      timerHandle = requestAnimationFrame(step)
    } else {
      ring.classList.remove('show')
    }
  }

  function stopTimer(caught: boolean): void {
    cancelAnimationFrame(timerHandle)
    ring.classList.remove('show')
    scene.stopTimer(caught)
  }

  function pressDigit(digit: number): void {
    if (!selection) return
    if (phase === 'settle') return
    app.audio.play('tap')
    const answer = selection.fact.a * selection.fact.b
    const width = String(answer).length
    if (typed.length >= width) typed = ''
    typed += String(digit)
    answerBox.textContent = typed
    if (typed.length >= width) window.setTimeout(submit, 60)
  }

  function pressClear(): void {
    typed = ''
    answerBox.textContent = ''
  }

  function pressOk(): void {
    if (typed.length > 0) submit()
  }

  function submit(): void {
    if (!selection || typed.length === 0) return
    const value = Number(typed)
    const answer = selection.fact.a * selection.fact.b

    if (phase === 'repair') {
      if (value !== answer) {
        typed = ''
        answerBox.textContent = ''
        return
      }
      // Right answer typed after the hint: no metres, just move on.
      engine.noteRepair(selection.fact)
      answerBox.className = 'again'
      answerBox.textContent = typed
      hint.hide()
      app.audio.duck(false)
      phase = 'settle'
      window.setTimeout(() => {
        if (round.answered >= ROUND_LENGTH) finish(false)
        else next()
      }, 450)
      return
    }

    const rt = (performance.now() - shownAt) / 1000
    const outcome = engine.record(selection.fact, value, rt, selection.limit)
    const result: AnswerResult = outcome.correct ? (outcome.fast ? 'fast' : 'slow') : 'wrong'
    stopTimer(result === 'fast')

    const step = applyAnswer(round, result, height, collected)
    height += step.metres
    for (const event of step.events) emit(event)

    gainPill.lastElementChild!.textContent = `${metres(round.gain)} m`
    countPill.lastElementChild!.textContent = `${Math.min(round.answered + 1, ROUND_LENGTH)}/${ROUND_LENGTH}`

    if (result === 'wrong') {
      phase = 'repair'
      typed = ''
      answerBox.className = ''
      answerBox.textContent = ''
      app.audio.duck(true)
      hint.show(selection.fact.a, selection.fact.b)
      return
    }

    answerBox.className = 'good'
    phase = 'settle'
    window.setTimeout(
      () => {
        if (round.answered >= ROUND_LENGTH) finish(false)
        else next()
      },
      result === 'fast' ? 560 : 400,
    )
  }

  function finish(early: boolean): void {
    stopTimer(false)
    hint.hide()
    app.audio.duck(false)
    const profile = app.store.profile
    const isRecord = !early && round.gain > profile.bestRound

    app.store.update((p) => {
      p.totalHeight = height
      p.collected = Array.from(collected)
      if (!early) {
        if (round.gain > p.bestRound) p.bestRound = round.gain
        noteRound(p)
      }
    })
    app.saveEngine(engine)

    if (early) {
      app.go('menu')
      return
    }

    const attention = engine.weakest(3).map((x) => ({
      label: `${x.fact.a} x ${x.fact.b}`,
      status: x.status,
    }))
    const summary: RoundSummary = {
      round,
      totalHeight: height,
      bestRound: Math.max(profile.bestRound, round.gain),
      isRecord,
      attention,
      newItems: newItems.filter((id) => ITEMS.some((it) => it.id === id)),
    }
    void startHeight
    app.go('result', summary)
  }

  return {
    root,
    dispose() {
      cancelAnimationFrame(timerHandle)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      numpad.dispose()
      scene.dispose()
      app.audio.duck(false)
    },
  }
}
