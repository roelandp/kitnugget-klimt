import { LeitnerEngine, DEFAULT_SETTINGS, HARD_SUMS } from './src/engine/leitner';
let currentTime = new Date('2026-09-01T08:00:00Z').getTime();
const now = () => currentTime;
const engine = new LeitnerEngine({}, 12345, now, DEFAULT_SETTINGS);

for (let day = 0; day < 1; day++) {
  for (let session = 0; session < 2; session++) {
    for (let q = 0; q < 20; q++) {
      const selection = engine.next();
      if (selection.key === '3x3' && selection.box === 2) {
         console.log('day', day, 'session', session, '3x3 is asked. Box:', selection.box);
         // How did it get here?
      }
      engine.record(selection.key, 'clean');
      currentTime += 5 * 1000;
    }
    currentTime += 12 * 60 * 60 * 1000;
  }
}
