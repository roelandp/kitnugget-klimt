import type { App, Screen } from '../app'
import { speak, stopSpeaking } from '../audio/speak'
import { LESSONS, lessonById, route, routeTip, type LessonId } from '../content/bouw'
import { itemById } from '../content/items'
import { makeRng } from '../engine/rng'
import { buildLesson, questionCount, weakestCounts, type Step } from '../game/bouw'
import { noteRound } from '../game/day'
import type { SceneEvent } from '../game/events'
import { applyAnswer, newRound, type AnswerResult } from '../game/progress'
import { Scene } from '../scene/scene'
import { el, metres } from './dom'
import { LegoPlate } from './lego'
import { Numpad } from './numpad'

export interface BouwLesPayload {
  table: number
  lesson: LessonId
}

/** A queued step, plus whether it is part of walking a wrong answer through its route. */
interface Queued extends Step {
  isRepair?: boolean
}

/**
 * One Bouwen lesson. The climb on top is the same as in the normal game, but
 * there is no clock and no mouse: every answer is reasoned out on a Lego plate
 * below. Right first time is a big jump, right after help a small step, and a
 * wrong answer only makes Kit Nugget look surprised while the plate helps out.
 */
export function bouwlesScreen(app: App, payload?: unknown): Screen {
  const { table: t, lesson } = payload as BouwLesPayload
  const info = lessonById(lesson) ?? LESSONS[0]
  const profile = app.store.profile
  const states = (profile.leitner?.states ?? {}) as Record<string, { box: number }>
  const steps: Queued[] = buildLesson(lesson, t, makeRng(Date.now() & 0x7fffffff), {
    weakest: weakestCounts(t, states),
    ownRhymes: profile.bouw.rhymes,
  })
  const total = questionCount(steps)

  const round = newRound(9999)
  const collected = new Set(profile.collected)
  const newItems: string[] = []
  let height = profile.totalHeight
  let index = -1
  let step: Queued | null = null
  let typed = ''
  let tries = 0
  let answered = 0
  let locked = true
  let autoHandle = 0
  let finished = false

  // ---------- chrome ----------
  const canvas = el('canvas', { id: 'scene-canvas' }) as HTMLCanvasElement
  const heightPill = el('div.pill', {}, el('small', { text: 'Hoogte' }), el('span', { text: '0 m' }))
  const gainPill = el('div.pill', {}, el('small', { text: 'Deze les' }), el('span', { text: '0 m' }))
  const countPill = el('div.pill', {}, el('small', { text: `Tafel van ${t}` }), el('span', { text: `0/${total}` }))
  const comboFlag = el('div', { id: 'combo-flag' })
  const quit = el('button.btn.small.ghost', { onclick: () => finish(true) }, 'Stop')
  const hud = el('div.hud', {}, heightPill, gainPill, countPill, el('div.spacer'), quit)
  const bubble = el('div.bouw-bubble')
  const sceneWrap = el('div', { id: 'scene-wrap', class: 'bouw' }, canvas, hud, comboFlag, bubble)

  const sayText = el('div.bouw-say-text')
  const speakBtn = el('button.bouw-speak', { type: 'button', 'aria-label': 'Lees voor', text: '🔊' })
  const say = el('div.bouw-say', {}, el('span.bouw-tag', { text: `${info.icon} ${info.title}` }), sayText, speakBtn)
  speakBtn.addEventListener('click', () => {
    if (step) speak(step.speak ?? sayText.textContent ?? '')
  })

  const plate = new LegoPlate()
  plate.onCount = (total) => {
    app.audio.play('tap')
    if (profile.bouw.speak) speak(String(total))
  }

  const sumText = el('div', { id: 'sum-text' })
  const answerBox = el('div', { id: 'answer-box' })
  const sumLine = el('div', { id: 'sum-line', class: 'bouw' }, sumText, el('div.eq', { text: '=' }), answerBox)

  const numpad = new Numpad({ onDigit: pressDigit, onClear: pressClear, onOk: pressOk })
  const goOn = el('button.btn.primary.bouw-go', { type: 'button', onclick: () => advance() }, 'Verder')
  const turnBtn = el('button.btn.primary.bouw-go.turn', { type: 'button', onclick: () => void doTurn() }, '↻  Draai de plaat')
  const rhymeInput = el('textarea.bouw-write', { rows: '2', maxlength: '140', placeholder: 'Bijvoorbeeld: Acht keer acht is vierenzestig...' }) as HTMLTextAreaElement
  const writeBox = el(
    'div.bouw-writebox',
    {},
    rhymeInput,
    el(
      'div.row',
      {},
      el('button.btn.ghost', { type: 'button', style: { flex: '1' }, onclick: () => advance() }, 'Overslaan'),
      el('button.btn.primary', { type: 'button', style: { flex: '2', minHeight: '52px', fontSize: '18px' }, onclick: () => saveRhyme() }, 'Bewaar mijn rijmpje'),
    ),
  )
  const controls = el('div.bouw-controls', {}, numpad.root, goOn, turnBtn, writeBox)
  const panel = el('div', { id: 'bouw-panel' }, say, plate.root, sumLine, controls)
  const root = el('div.screen.bouw-screen', {}, sceneWrap, panel)

  // Typing in the rhyme box must not feed the keypad.
  rhymeInput.addEventListener('keydown', (e) => e.stopPropagation())

  const scene = new Scene(canvas, app.assets, app.dresser)
  scene.setCollected(collected)
  scene.setDecorations(Object.values(profile.decorations ?? {}).filter(Boolean) as string[])
  scene.setHeight(height)
  scene.onHeight = (m, parallax) => {
    app.backdrop.update(m, parallax)
    heightPill.lastElementChild!.textContent = `${metres(m)} m`
  }
  const onResize = () => scene.resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  const sceneObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
  sceneObserver?.observe(sceneWrap)

  requestAnimationFrame(() => {
    scene.resize()
    scene.start()
    app.backdrop.update(height, 0)
    emit({ type: 'roundStart' })
    advance()
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
        comboFlag.textContent = `Combo ${event.n}!`
        comboFlag.classList.add('show')
        window.setTimeout(() => comboFlag.classList.remove('show'), 900)
        break
      case 'itemCollected':
        app.audio.play('item')
        newItems.push(event.id)
        break
      case 'zoneChanged':
        app.audio.setZone(event.id)
        break
      default:
        break
    }
  }

  function score(result: AnswerResult): void {
    const out = applyAnswer(round, result, height, collected)
    height += out.metres
    for (const event of out.events) if (event.type !== 'roundEnd') emit(event)
    gainPill.lastElementChild!.textContent = `${metres(round.gain)} m`
  }

  function showBubble(text: string): void {
    bubble.textContent = text
    bubble.classList.remove('show')
    void bubble.offsetWidth
    bubble.classList.add('show')
  }

  function mode(which: 'numpad' | 'go' | 'turn' | 'write' | 'none'): void {
    // The keypad keeps its place so the scene never jumps; it only fades out.
    numpad.root.classList.toggle('ghosted', which !== 'numpad')
    goOn.classList.toggle('hidden', which !== 'go')
    turnBtn.classList.toggle('hidden', which !== 'turn')
    writeBox.classList.toggle('hidden', which !== 'write')
  }

  function advance(): void {
    window.clearTimeout(autoHandle)
    if (finished) return
    index += 1
    if (index >= steps.length) {
      finish(false)
      return
    }
    step = steps[index]
    typed = ''
    tries = 0
    locked = false
    sayText.textContent = step.say
    say.classList.remove('help', 'good')
    answerBox.className = ''
    answerBox.textContent = ''
    sumText.textContent = step.sum ?? ''
    sumLine.classList.toggle('hidden', !step.sum)
    scene.setPose('hang')

    if (step.turn && step.plate) plate.renderTurned(step.plate)
    else plate.render(step.plate)

    if (step.speak && profile.bouw.speak) speak(step.speak)
    else stopSpeaking()

    if (step.auto) {
      mode('none')
      locked = true
      scene.setPose('happy')
      showBubble(step.say)
      app.audio.play('step')
      autoHandle = window.setTimeout(advance, 1300)
      return
    }
    if (step.write) {
      mode('write')
      rhymeInput.value = profile.bouw.rhymes[`${step.write.n}x${step.write.t}`] ?? ''
      return
    }
    if (step.answer === undefined) {
      mode('go')
      return
    }
    if (step.turn) {
      mode('turn')
      locked = true
      return
    }
    mode('numpad')
  }

  async function doTurn(): Promise<void> {
    if (!step?.turn) return
    turnBtn.classList.add('hidden')
    app.audio.play('jump')
    await plate.turn()
    if (finished) return
    mode('numpad')
    locked = false
  }

  function pressDigit(digit: number): void {
    if (!step || locked || step.answer === undefined) return
    app.audio.play('tap')
    const width = String(step.answer).length
    if (typed.length >= width) typed = ''
    typed += String(digit)
    answerBox.className = ''
    answerBox.textContent = typed
    if (typed.length >= width) window.setTimeout(submit, 80)
  }

  function pressClear(): void {
    if (locked) return
    typed = ''
    answerBox.textContent = ''
  }

  function pressOk(): void {
    if (!step) return
    if (step.answer === undefined && !step.auto && !step.write) {
      advance()
      return
    }
    if (typed.length > 0) submit()
  }

  function submit(): void {
    if (!step || locked || step.answer === undefined || typed.length === 0) return
    const value = Number(typed)
    typed = ''
    if (value === step.answer) right()
    else wrong()
  }

  function right(): void {
    if (!step) return
    locked = true
    const firstTry = tries === 0 && !step.isRepair
    score(firstTry ? 'fast' : 'slow')
    if (!step.isRepair) answered += 1
    countPill.lastElementChild!.textContent = `${Math.min(answered, total)}/${total}`
    answerBox.className = 'good'
    answerBox.textContent = String(step.answer)
    scene.setPose(firstTry ? 'happy' : 'hang')
    plate.render(step.plate ? { ...step.plate, hideLast: false } : undefined)
    const line = step.after ?? (firstTry ? 'Goed zo!' : 'Ja, zo zit het!')
    sayText.textContent = line
    say.classList.remove('help')
    say.classList.add('good')
    if (step.after && step.speak && profile.bouw.speak) speak(step.after)
    window.setTimeout(advance, step.after ? 1700 : 750)
  }

  function wrong(): void {
    if (!step || step.answer === undefined) return
    tries += 1
    answerBox.className = 'again'
    if (tries === 1 && !step.isRepair) score('wrong')
    else app.audio.play('wrong')

    // Walk the sum through its anchor route, then come back to it.
    if (step.repair && tries === 1 && !step.isRepair) {
      const { n, t: tt } = step.repair
      const walk: Queued[] = route(n, tt).map((r, i, all) => ({
        say: i === 0 ? `Samen bouwen: ${r.say}` : r.say,
        sum: r.sum,
        answer: r.answer,
        plate: r.plate,
        help: routeTip(n, tt),
        after: i === all.length - 1 ? `Dus ${n} x ${tt} = ${n * tt}.` : undefined,
        isRepair: true,
      }))
      steps.splice(index + 1, 0, ...walk)
      // The question itself counts as done; the route earns the small steps.
      answered += 1
      countPill.lastElementChild!.textContent = `${Math.min(answered, total)}/${total}`
      locked = true
      sayText.textContent = 'Hmm, bijna. We bouwen hem samen!'
      say.classList.add('help')
      window.setTimeout(() => {
        answerBox.textContent = ''
        advance()
      }, 1100)
      return
    }

    const hint = tries >= 3 ? `Het is ${step.answer}. Typ het maar over.` : step.help ?? 'Kijk nog eens naar de stenen.'
    sayText.textContent = hint
    say.classList.add('help')
    if (profile.bouw.speak && tries >= 2) speak(hint)
    window.setTimeout(() => {
      if (step && !locked) {
        answerBox.className = ''
        answerBox.textContent = ''
      }
    }, 600)
  }

  function saveRhyme(): void {
    if (!step?.write) return
    const text = rhymeInput.value.trim()
    if (!text) {
      advance()
      return
    }
    const key = `${step.write.n}x${step.write.t}`
    app.store.update((p) => {
      p.bouw.rhymes[key] = text
    })
    rhymeInput.blur()
    score('fast')
    scene.setPose('happy')
    sayText.textContent = 'Wat een goed rijmpje! Kit Nugget onthoudt het voor je.'
    say.classList.add('good')
    if (profile.bouw.speak) speak(text)
    mode('none')
    window.setTimeout(advance, 1800)
  }

  function finish(early: boolean): void {
    if (finished) return
    finished = true
    window.clearTimeout(autoHandle)
    stopSpeaking()
    const done = app.store.profile.bouw.done[String(t)] ?? []
    const wasClicked = LESSONS.every((l) => done.includes(l.id))
    app.store.update((p) => {
      p.totalHeight = height
      p.collected = Array.from(collected)
      if (!early) {
        const list = new Set(p.bouw.done[String(t)] ?? [])
        list.add(lesson)
        p.bouw.done[String(t)] = Array.from(list)
        noteRound(p)
      }
    })
    if (early) {
      app.go('bouw')
      return
    }
    const nowDone = app.store.profile.bouw.done[String(t)] ?? []
    const clicked = !wasClicked && LESSONS.every((l) => nowDone.includes(l.id))
    emit({ type: 'combo', n: clicked ? 12 : 6 })
    scene.setPose('happy')
    app.audio.play('roundEnd')
    showEnd(clicked, nowDone)
  }

  function showEnd(clicked: boolean, done: string[]): void {
    mode('none')
    const next = LESSONS.find((l) => !done.includes(l.id))
    const items = newItems.map((id) => itemById(id)).filter(Boolean)
    const paws = el(
      'div.bouw-paws',
      {},
      ...LESSONS.map((l) => el('span', { class: done.includes(l.id) ? 'on' : '', title: l.title, text: l.icon })),
    )
    const card = el(
      'div.bouw-end',
      {},
      el('div.result-big', {}, el('b', { text: `+${metres(round.gain)} m` }), el('span', { text: `${info.title} is klaar` })),
      clicked ? el('div.bouw-clicked', { text: `De tafel van ${t} klikt! Alle stenen zitten op hun plek.` }) : null,
      paws,
      items.length ? el('div.bouw-items', { text: `Gevonden: ${items.map((it) => it!.naam).join(', ')}` }) : null,
      el(
        'div.row',
        { style: { gap: '8px', marginTop: '6px' } },
        el('button.btn', { type: 'button', style: { flex: '1' }, onclick: () => app.go('bouw') }, 'Terug'),
        next
          ? el('button.btn.primary', { type: 'button', style: { flex: '2' }, onclick: () => app.go('bouwles', { table: t, lesson: next.id }) }, `${next.icon} ${next.title}`)
          : el('button.btn.primary', { type: 'button', style: { flex: '2' }, onclick: () => app.go('bouwles', { table: t, lesson: 'proef' }) }, 'Nog een bouwproef'),
      ),
    )
    panel.replaceChildren(card)
    if (profile.bouw.speak) speak(clicked ? `De tafel van ${t} klikt!` : 'Les klaar!')
  }

  return {
    root,
    dispose() {
      finished = true
      window.clearTimeout(autoHandle)
      stopSpeaking()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      sceneObserver?.disconnect()
      numpad.dispose()
      plate.dispose()
      scene.dispose()
    },
  }
}
