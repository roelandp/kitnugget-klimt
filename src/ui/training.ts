import type { App, Screen } from '../app'
import { generateChoices } from '../engine/choices'
import type { LeitnerEngine, LeitnerSelection } from '../engine/leitner'
import type { SceneEvent } from '../game/events'
import { ROUND_LENGTH, applyAnswer, newRound, type AnswerResult, type RoundState } from '../game/progress'
import { Scene } from '../scene/scene'
import { Choices } from './choices'
import { el, metres } from './dom'
import { hintFor, type Hint } from '../content/hints'
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
export function trainingScreen(app: App): Screen {
  const engine: LeitnerEngine = app.makeLeitner()
  const round = newRound(ROUND_LENGTH)
  const collected = new Set(app.store.profile.collected)
  const newItems: string[] = []
  let height = app.store.profile.totalHeight
  
  let selection: LeitnerSelection | null = null
    let typed = ''
  let phase: 'answer' | 'repair' | 'settle' = 'answer'
  let timerHandle = 0
  let currentHint: Hint | null = null
  let repairStep: 1 | 2 = 1

  // ---------- chrome ----------
  const canvas = el('canvas', { id: 'scene-canvas' }) as HTMLCanvasElement
  const heightPill = el('div.pill', {}, el('small', { text: 'Hoogte' }), el('span', { text: '0 m' }))
  const gainPill = el('div.pill', {}, el('small', { text: 'Deze ronde' }), el('span', { text: '0 m' }))
  const countPill = el('div.pill', {}, el('small', { text: 'Tijd' }), el('span', { text: '02:00' }))
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
  const hint = new HintSheet()
  const sceneWrap = el('div', { id: 'scene-wrap' }, canvas, hud, comboFlag, ring as unknown as HTMLElement, hint.root)

  const sumText = el('div', { id: 'sum-text', text: '' })
  const answerBox = el('div', { id: 'answer-box', text: '' })
  
  const punishBar = el('div.punish-bar-wrap', { style: { display: 'none', height: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px', margin: '10px 20px', overflow: 'hidden' } })
  const punishFill = el('div.punish-bar-fill', { style: { height: '100%', background: '#ff4a4a', width: '100%', transformOrigin: 'left', transition: 'none' } })
  punishBar.appendChild(punishFill)

  
  const hintBtn = el('button.btn.ghost.small', { style: { marginLeft: '10px' }, onclick: () => triggerHint() }, '💡 Hint')
  const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox, hintBtn)

  const inputMode = app.store.profile.settings.inputMode ?? 'keuze'
  const numpad = inputMode === 'open' ? new Numpad({ onDigit: pressDigit, onClear: pressClear, onOk: pressOk }) : null
  const choices = inputMode === 'keuze' ? new Choices({ onSelect: handleChoiceSelect }) : null
  const panel = el('div', { id: 'panel' }, sumLine, punishBar,  inputMode === 'keuze' ? choices!.root : numpad!.root)
  const root = el('div.screen', {}, sceneWrap, panel)

  const scene = new Scene(canvas, app.assets, app.dresser)
  scene.setMouseStyle(app.store.profile.settings.timerStyle)
  scene.setCollected(collected)
  scene.setDecorations(Object.values(app.store.profile.decorations ?? {}).filter(Boolean) as string[])
  scene.setHeight(height)
  scene.onHeight = (m, parallax) => {
    app.backdrop.update(m, parallax)
    heightPill.lastElementChild!.textContent = `${metres(m)} m`
  }

  
  const SESSION_SECONDS = 120;
  let sessionStart = 0;
  let timeRemaining = SESSION_SECONDS;
  let clockHandle = 0;
  let extraQuestions = 0;
  let sessionEnded = false;
  
  function updateClock() {
    if (sessionEnded) return;
    const elapsed = (performance.now() - sessionStart) / 1000;
    timeRemaining = Math.max(0, SESSION_SECONDS - elapsed);
    const m = Math.floor(timeRemaining / 60);
    const s = Math.floor(timeRemaining % 60);
    countPill.lastElementChild!.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    
    clockHandle = requestAnimationFrame(updateClock);
  }

  const onResize = () => scene.resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)

  requestAnimationFrame(() => {
    sessionStart = performance.now();
    updateClock();
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
    if (timeRemaining <= 0 && extraQuestions <= 0) {
      finish(false);
      return;
    }
    
    hint.hide(); // Hide the hint if it was manually opened
 && extraQuestions <= 0) {
      finish(false);
      return;
    }
    
    hint.hide()
    selection = engine.next()
    typed = ''
    phase = 'answer'
    scene.setPose('hang')
    answerBox.className = ''
    answerBox.textContent = inputMode === 'keuze' ? '?' : ''
    sumText.textContent = selection.display
    
    hintBtn.style.display = 'block';
    
    if (selection.timer) {
      startTimer(selection.timer * (app.store.profile.settings.timeScale ?? 1))
    } else {
      ring.classList.remove('show');
    }

    if (inputMode === 'keuze' && choices) {
      const opts = generateChoices(selection.a, selection.b)
      choices.setChoices(opts)
    }
  }


  
  let lockHandle = 0;
  function startLockDelay(onComplete: () => void) {
    if (inputMode === 'open') {
      onComplete();
      return;
    }
    const delay = (app.store.profile.settings.guessDelay ?? 7) * 1000;
    const start = performance.now();
    punishBar.style.display = 'block';
    punishFill.style.transform = 'scaleX(1)';
    choices?.setLocked(true);
    
    cancelAnimationFrame(lockHandle);
    
    function step() {
      const p = Math.max(0, 1 - (performance.now() - start) / delay);
      punishFill.style.transform = `scaleX(${p})`;
      if (p > 0 && phase === 'repair') {
        lockHandle = requestAnimationFrame(step);
      } else {
        punishBar.style.display = 'none';
        if (phase === 'repair') {
          onComplete();
        }
      }
    }
    lockHandle = requestAnimationFrame(step);
  }

  let usedHint = false;
  function triggerHint() {
    if (phase !== 'answer' || !selection) return;
    usedHint = true;
    hintBtn.style.display = 'none';
    currentHint = hintFor(selection.a, selection.b);
    hint.show(currentHint, 2);
  }

  function handleTimeout() {
    if (!selection || phase !== 'answer') return;
    app.audio.play('wrong'); 
    engine.record(selection.key, 'timeout');
    
    phase = 'settle';
    choices?.setLocked(true);
    ring.classList.remove('show');
    
    window.setTimeout(() => {
      checkEndAndNext();
    }, 400);
  }

  function startTimer(limit: number): void {
    scene.startTimer(limit)
    if (app.store.profile.settings.timerStyle === 'ring') {
      ring.classList.add('show')
      const begin = performance.now()
      const step = () => {
        const p = Math.min(1, (performance.now() - begin) / (limit * 1000))
        ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p))
        if (p < 1 && phase === 'answer') {
          timerHandle = requestAnimationFrame(step)
        } else if (p >= 1 && phase === 'answer') {
          handleTimeout()
        }
      }
      timerHandle = requestAnimationFrame(step)
    } else {
      ring.classList.remove('show')
    }
  }

  function stopTimer(caught: boolean): void {
    cancelAnimationFrame(timerHandle)
      cancelAnimationFrame(lockHandle)
      cancelAnimationFrame(clockHandle)
      cancelAnimationFrame(lockHandle)
      cancelAnimationFrame(lockHandle)
    ring.classList.remove('show')
    scene.stopTimer(caught)
  }

  
  function triggerRepair(wrongValue?: number): void {
    if (!selection) return
    phase = 'repair'
    if (wrongValue !== undefined) choices?.highlight(wrongValue, 'wrong')
    typed = ''
    answerBox.className = ''
    app.audio.duck(true)
    hintBtn.style.display = 'none';

    currentHint = hintFor(selection.a, selection.b)
    if (currentHint.breakdown?.intermediate) {
      repairStep = 2 
      hint.show(currentHint, 1) 
      hint.markStep1Done(currentHint.breakdown.intermediate.answer); 
      hint.setStep(2); 
      
      sumText.textContent = currentHint.breakdown.finalStep.formula
      answerBox.textContent = inputMode === 'keuze' ? '?' : ''
      if (inputMode === 'keuze' && choices) {
        choices.setChoices(currentHint.breakdown.finalStep.choices)
        startLockDelay(() => { if (phase === 'repair') choices?.setLocked(false) })
      }
    } else {
      repairStep = 2
      hint.show(currentHint, 2)
      sumText.textContent = selection.display
      answerBox.textContent = inputMode === 'keuze' ? '?' : ''
      if (inputMode === 'keuze' && choices) {
        choices.setChoices(currentHint.breakdown?.finalStep.choices ?? generateChoices(selection.a, selection.b))
        startLockDelay(() => { if (phase === 'repair') choices?.setLocked(false) })
      }
    }
  }

  function handleRepairSubmit(value: number): void {
    if (!selection || !currentHint?.breakdown) return

    const expectedFinal = selection.a * selection.b
    if (value !== expectedFinal) {
      app.audio.play('tap')
      choices?.highlight(value, 'wrong')
      answerBox.className = 'wrong'
      typed = ''
      window.setTimeout(() => {
        if (phase === 'repair') {
          answerBox.className = ''
          answerBox.textContent = inputMode === 'keuze' ? '?' : ''
        }
      }, 400)
      return
    }

    app.audio.play('tap')
    choices?.highlight(value, 'correct')
    choices?.setLocked(true)
    hint.markStep2Done(value)
    answerBox.className = 'again'
    answerBox.textContent = String(value)
    hint.hide()
    app.audio.duck(false)
    phase = 'settle'
    
    const step = applyAnswer(round, 'slow', height, collected)
    height += step.metres
    for (const event of step.events) emit(event)
    
    window.setTimeout(() => {
      checkEndAndNext();
    }, 450)
  }


  
  function handleChoiceSelect(value: number): void {
    if (!selection || phase === 'settle') return

    if (phase === 'repair') {
      handleRepairSubmit(value)
      return
    }

    app.audio.play('tap')
    answerBox.textContent = String(value)
    const expected = selection.a * selection.b;
    const correct = value === expected;
    
    let outcome: 'clean' | 'hint' | 'wrong' | 'timeout' = 'clean';
    if (!correct) outcome = 'wrong';
    else if (usedHint) outcome = 'hint';
    
    engine.record(selection.key, outcome);
    
    if (!correct) {
      if (extraQuestions === 0) extraQuestions = 2;
    } else {
      if (extraQuestions > 0) extraQuestions--;
    }

    const result: AnswerResult = correct ? (usedHint ? 'slow' : 'fast') : 'wrong'
    stopTimer(result === 'fast')

    const step = applyAnswer(round, result, height, collected)
    height += step.metres
    for (const event of step.events) emit(event)

    gainPill.lastElementChild!.textContent = `${metres(round.gain)} m`

    if (result === 'wrong') {
      triggerRepair(value)
      return
    }

    choices?.highlight(value, 'correct')
    choices?.setLocked(true)
    answerBox.className = 'good'
    phase = 'settle'
    window.setTimeout(
      () => {
        checkEndAndNext();
      },
      result === 'fast' ? 560 : 400,
    )
  }
  
  function checkEndAndNext() {
    usedHint = false;
    if (timeRemaining <= 0 && extraQuestions <= 0) {
      finish(false);
    } else {
      next();
    }
  }


  function pressDigit(digit: number): void {
    if (!selection) return
    if (phase === 'settle') return
    app.audio.play('tap')
    let targetAnswer = selection.a * selection.b
    if (phase === 'repair' && repairStep === 1 && currentHint?.breakdown?.intermediate) {
      targetAnswer = currentHint.breakdown.intermediate.answer
    }
    const width = String(targetAnswer).length
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

    if (phase === 'repair') {
      handleRepairSubmit(value)
      return
    }

    const expected = selection.a * selection.b;
    const correct = value === expected;
    
    let outcome: 'clean' | 'hint' | 'wrong' | 'timeout' = 'clean';
    if (!correct) outcome = 'wrong';
    else if (usedHint) outcome = 'hint';
    
    engine.record(selection.key, outcome);
    
    if (!correct) {
      if (extraQuestions === 0) extraQuestions = 2;
    } else {
      if (extraQuestions > 0) extraQuestions--;
    }

    const result: AnswerResult = correct ? (usedHint ? 'slow' : 'fast') : 'wrong'
    stopTimer(result === 'fast')

    const step = applyAnswer(round, result, height, collected)
    height += step.metres
    for (const event of step.events) emit(event)

    gainPill.lastElementChild!.textContent = `${metres(round.gain)} m`

    if (result === 'wrong') {
      triggerRepair()
      return
    }

    answerBox.className = 'good'
    phase = 'settle'
    window.setTimeout(
      () => {
        checkEndAndNext();
      },
      result === 'fast' ? 560 : 400,
    )
  }


  
  function finish(early: boolean): void {
    sessionEnded = true;
    stopTimer(false)
    cancelAnimationFrame(clockHandle)
    hint.hide()
    app.audio.duck(false)

    app.store.update((p) => {
      p.totalHeight = height
      p.collected = Array.from(collected)
    })
    app.saveLeitner(engine)

    if (early) {
      app.go('menu')
      return
    }

    app.go('veroverkaart')
  }


  return {
    root,
    dispose() {
      cancelAnimationFrame(timerHandle)
      cancelAnimationFrame(lockHandle)
      cancelAnimationFrame(clockHandle)
      cancelAnimationFrame(lockHandle)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      numpad?.dispose()
      choices?.dispose()
      scene.dispose()
      app.audio.duck(false)
    },
  }
}
