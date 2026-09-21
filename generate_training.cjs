const fs = require('fs');

let game = fs.readFileSync('src/ui/game.ts', 'utf8');

// Replace imports
game = game.replace(
  "import type { Engine, Selection } from '../engine/engine'",
  "import type { LeitnerEngine, LeitnerSelection } from '../engine/leitner'"
);
game = game.replace(
  "export function gameScreen(app: App): Screen {",
  "export function trainingScreen(app: App): Screen {"
);

// Replace engine init
game = game.replace(
  "const engine: Engine = app.makeEngine()",
  "const engine: LeitnerEngine = app.makeLeitner()"
);
game = game.replace(
  "let selection: Selection | null = null",
  "let selection: LeitnerSelection | null = null"
);

// Paws/timer UI
game = game.replace(
  "const countPill = el('div.pill', {}, el('small', { text: 'Som' }), el('span', { text: `1/\${ROUND_LENGTH}` }))",
  "const countPill = el('div.pill', {}, el('small', { text: 'Tijd' }), el('span', { text: '02:00' }))"
);

// Hint button
const panelReplace = `
  const hintBtn = el('button.btn.ghost.small', { style: { marginLeft: '10px' }, onclick: () => triggerHint() }, '💡 Hint')
  const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox, hintBtn)
`;
game = game.replace("const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox)", panelReplace);

// Session timer logic
const timerReplace = `
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
    countPill.lastElementChild!.textContent = \`\${String(m).padStart(2,'0')}:\${String(s).padStart(2,'0')}\`;
    
    clockHandle = requestAnimationFrame(updateClock);
  }
`;
game = game.replace("const onResize = () => scene.resize()", timerReplace + "\n  const onResize = () => scene.resize()");
game = game.replace("requestAnimationFrame(() => {\n    scene.resize()", "requestAnimationFrame(() => {\n    sessionStart = performance.now();\n    updateClock();\n    scene.resize()");

// The functions replacement
// Find start of `function emit` to replace everything from `function next` to `function finish` safely.
// We'll just replace the specific functions.

// function next
const nextFn = `
  function next(): void {
    if (timeRemaining <= 0 && extraQuestions <= 0) {
      finish(false);
      return;
    }
    
    selection = engine.next()
    typed = ''
    phase = 'answer'
    scene.setPose('hang')
    answerBox.className = ''
    answerBox.textContent = inputMode === 'keuze' ? '?' : ''
    sumText.textContent = selection.display
    shownAt = performance.now()
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
`;
game = game.replace(/function next\(\): void \{[\s\S]*?function startTimer/m, nextFn + "\n\n  function startTimer");

const lockFn = `
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
      punishFill.style.transform = \`scaleX(\${p})\`;
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
`;

// Insert lockFn before startTimer
game = game.replace("function startTimer", lockFn + "\n  function startTimer");

const oldStep = `const step = () => {
        const p = Math.min(1, (performance.now() - begin) / (limit * 1000))
        ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p))
        if (p < 1 && phase === 'answer') timerHandle = requestAnimationFrame(step)
      }`;

const newStep = `const step = () => {
        const p = Math.min(1, (performance.now() - begin) / (limit * 1000))
        ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p))
        if (p < 1 && phase === 'answer') {
          timerHandle = requestAnimationFrame(step)
        } else if (p >= 1 && phase === 'answer') {
          handleTimeout()
        }
      }`;
game = game.replace(oldStep, newStep);

const repairFn = `
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
`;
game = game.replace(/function triggerRepair[\s\S]*?function handleChoiceSelect/m, repairFn + "\n\n  function handleChoiceSelect");

const choicesSubmitFn = `
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

    const result: AnswerResult = correct ? (selection.timer ? 'fast' : 'slow') : 'wrong'
    stopTimer(result === 'fast')

    const step = applyAnswer(round, result, height, collected)
    height += step.metres
    for (const event of step.events) emit(event)

    gainPill.lastElementChild!.textContent = \`\${metres(round.gain)} m\`

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
`;
game = game.replace(/function handleChoiceSelect[\s\S]*?function pressDigit/m, choicesSubmitFn + "\n\n  function pressDigit");

const typedSubmitFn = `
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

    const result: AnswerResult = correct ? (selection.timer ? 'fast' : 'slow') : 'wrong'
    stopTimer(result === 'fast')

    const step = applyAnswer(round, result, height, collected)
    height += step.metres
    for (const event of step.events) emit(event)

    gainPill.lastElementChild!.textContent = \`\${metres(round.gain)} m\`

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
`;
game = game.replace(/function submit\(\): void \{[\s\S]*?function finish/m, typedSubmitFn + "\n\n  function finish");

// finish
const finishFn = `
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
`;
game = game.replace(/function finish[\s\S]*?return \{/m, finishFn + "\n\n  return {");

// Clean up unused timer logic
game = game.replace(/cancelAnimationFrame\(timerHandle\)/g, "cancelAnimationFrame(timerHandle)\n      cancelAnimationFrame(lockHandle)\n      cancelAnimationFrame(clockHandle)");

fs.writeFileSync('src/ui/training.ts', game);
