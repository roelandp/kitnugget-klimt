const fs = require('fs');
let code = fs.readFileSync('src/ui/training.ts', 'utf8');

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

code = code.replace(oldStep, newStep);
fs.writeFileSync('src/ui/training.ts', code);
