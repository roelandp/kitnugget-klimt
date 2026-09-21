const fs = require('fs');
let code = fs.readFileSync('src/ui/training.ts', 'utf8');

// Imports
code = code.replace(
  "import type { Engine, Selection } from '../engine/engine'",
  "import type { LeitnerEngine, LeitnerSelection } from '../engine/leitner'"
);
code = code.replace(
  "export function gameScreen(app: App): Screen {",
  "export function trainingScreen(app: App): Screen {"
);

code = code.replace(
  "const engine: Engine = app.makeEngine()",
  "const engine: LeitnerEngine = app.makeLeitner()"
);

code = code.replace(
  "let selection: Selection | null = null",
  "let selection: LeitnerSelection | null = null"
);

code = code.replace(
  "const countPill = el('div.pill', {}, el('small', { text: 'Som' }), el('span', { text: \`1/\${ROUND_LENGTH}\` }))",
  "const countPill = el('div.pill', {}, el('small', { text: 'Tijd' }), el('span', { text: '02:00' }))"
);

// We need a hint button
const panelReplace = `
  const hintBtn = el('button.btn.ghost.small', { style: { marginLeft: '10px' }, onclick: () => triggerHint() }, '💡 Hint')
  const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox, hintBtn)
`;
code = code.replace("const sumLine = el('div', { id: 'sum-line' }, sumText, el('div', { text: '=' }), answerBox)", panelReplace);

// Timer logic
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
    
    if (timeRemaining <= 0) {
      if (phase === 'answer' && extraQuestions === 0) {
        // Just started a new question when time ran out, or time ran out on current.
        // Wait, rule: "stopt dan vanzelf... Eindig altijd op een succes: was het laatste antwoord fout, stel dan nog maximaal 2 makkelijke vragen zonder timer."
        // We will just let them finish the current question. The ending check is in handleChoiceSelect.
      }
    }
    clockHandle = requestAnimationFrame(updateClock);
  }
`;

code = code.replace("const onResize = () => scene.resize()", timerReplace + "\n  const onResize = () => scene.resize()");
code = code.replace("requestAnimationFrame(() => {\n    scene.resize()", "requestAnimationFrame(() => {\n    sessionStart = performance.now();\n    updateClock();\n    scene.resize()");

// Replace next()
const nextReplace = `
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
code = code.replace(/function next\(\): void \{[\s\S]*?\}\n/m, nextReplace + "\n");

// Hint logic
const hintLogic = `
  let usedHint = false;
  function triggerHint() {
    if (phase !== 'answer' || !selection) return;
    usedHint = true;
    hintBtn.style.display = 'none';
    currentHint = hintFor(selection.a, selection.b);
    hint.show(currentHint, 2); // In learning mode, hint button just shows the full hint if we want. Actually "Zelfde strategie als de uitleg bij een fout." 
    // Wait, "Knop vooraf beschikbaar, bij fout doet Kit Nugget stap 1 voor jou."
    // If they click Hint, they just see the hint.
    // Let's show step 1, but we don't force them to type it in the hint sheet if they just clicked Hint. They just read it.
    // Actually, triggerRepair handles typing step 1. If they click hint, let's just show it.
  }
`;
code = code.replace("function startTimer", hintLogic + "\n  function startTimer");

// triggerRepair
// "Maximaal 2 subsommen. Kit Nugget doet stap 1 voor, hij lost alleen stap 2 op."
const triggerRepairReplace = `
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
      repairStep = 2 // Skip step 1 for user, Kit Nugget did it
      hint.show(currentHint, 1) // show step 1
      hint.markStep1Done(currentHint.breakdown.intermediate.answer); // Mark it done automatically
      hint.setStep(2); // move to step 2
      
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
`;
code = code.replace(/function triggerRepair[\s\S]*?function handleRepairSubmit/m, triggerRepairReplace + "\n\n  function handleRepairSubmit");

// handleRepairSubmit
// "Dan goed: Kit Nugget klimt, maar geen bakjeswinst."
const handleRepairSubmitReplace = `
  function handleRepairSubmit(value: number): void {
    if (!selection || !currentHint?.breakdown) return

    // Final step of repair
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

    // Correct final step!
    app.audio.play('tap')
    choices?.highlight(value, 'correct')
    choices?.setLocked(true)
    hint.markStep2Done(value)
    answerBox.className = 'again'
    answerBox.textContent = String(value)
    hint.hide()
    app.audio.duck(false)
    phase = 'settle'
    
    // Kit nugget climbs
    const step = applyAnswer(round, 'slow', height, collected)
    height += step.metres
    for (const event of step.events) emit(event)
    
    window.setTimeout(() => {
      checkEndAndNext();
    }, 450)
  }
`;
code = code.replace(/function handleRepairSubmit[\s\S]*?function handleChoiceSelect/m, handleRepairSubmitReplace + "\n\n  function handleChoiceSelect");

// handleChoiceSelect
const handleChoiceSelectReplace = `
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
    // timeout is handled elsewhere, but for now we don't trigger it here.
    
    engine.record(selection.key, outcome);
    
    if (!correct) {
      if (extraQuestions === 0) extraQuestions = 2; // Need to end on a success
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
code = code.replace(/function handleChoiceSelect[\s\S]*?function pressDigit/m, handleChoiceSelectReplace + "\n\n  function pressDigit");

// finish
const finishReplace = `
  function finish(early: boolean): void {
    sessionEnded = true;
    stopTimer(false)
    cancelAnimationFrame(clockHandle)
    hint.hide()
    app.audio.duck(false)
    const profile = app.store.profile

    app.store.update((p) => {
      p.totalHeight = height
      p.collected = Array.from(collected)
    })
    app.saveLeitner(engine)

    if (early) {
      app.go('menu')
      return
    }

    // Go to the conquest map
    app.go('veroverkaart')
  }
`;
code = code.replace(/function finish[\s\S]*?return \{/m, finishReplace + "\n\n  return {");

fs.writeFileSync('src/ui/training.ts', code);
