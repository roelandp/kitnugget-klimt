const fs = require('fs');
let code = fs.readFileSync('src/ui/training.ts', 'utf8');

const submitReplace = `
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
code = code.replace(/function submit\(\): void \{[\s\S]*?function finish/m, submitReplace + "\n\n  function finish");

// Also, the old game.ts has a timeout feature inside Scene or something?
// Actually, `stopTimer(caught)` is called. If time runs out, does it trigger a wrong answer automatically?
// The current engine does NOT trigger wrong answer on timeout. It just hides the timer and scores it as "slow".
// "Te laat is geen fout: geen uitleg, de som zakt één bakje en de timer is weer weg."
// I need to intercept the timeout event.
// How does the game know about a timeout?
// `scene.startTimer(limit)` doesn't trigger anything. The UI timer (`ring` and `timerHandle`) just runs.
// In `game.ts` / `training.ts`, if the timer ring reaches 0, nothing happens! The user can still answer, they just get a `slow` result.
// Wait! If `timeRemaining` of the 6s timer reaches 0, I should probably execute the timeout logic.
// Let's modify the local timer loop in `startTimer` to trigger timeout.
const timerFixReplace = `
    function step() {
      const p = Math.max(0, 1 - (performance.now() - start) / limitMs);
      ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p));
      if (p > 0 && phase === 'answer') {
        timerHandle = requestAnimationFrame(step);
      } else if (p === 0 && phase === 'answer') {
        handleTimeout();
      }
    }
`;
code = code.replace(/const step = \(\) => \{[\s\S]*?timerHandle = requestAnimationFrame\(step\)\n      \}/m, timerFixReplace);

const handleTimeoutFn = `
  function handleTimeout() {
    if (!selection || phase !== 'answer') return;
    app.audio.play('wrong'); // or something to indicate timeout
    engine.record(selection.key, 'timeout');
    
    // Zakt 1 bakje, timer is weer weg
    // Proceed to next directly
    phase = 'settle';
    choices?.setLocked(true);
    ring.classList.remove('show');
    
    window.setTimeout(() => {
      checkEndAndNext();
    }, 400);
  }
`;
code = code.replace("function startTimer", handleTimeoutFn + "\n  function startTimer");

// The original ring step code was:
// const step = () => {
//   const p = Math.min(1, (performance.now() - begin) / (limit * 1000))
//   ringArc.setAttribute('stroke-dashoffset', String(RING_LEN * p))
//   if (p < 1 && phase === 'answer') timerHandle = requestAnimationFrame(step)
// }
// I should fix the regex replacement since I wrote it wrong.

fs.writeFileSync('src/ui/training.ts', code);
