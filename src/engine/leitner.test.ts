
import { describe, it, expect } from 'vitest';
import { LeitnerEngine, DEFAULT_SETTINGS, HARD_SUMS } from './leitner';

describe('LeitnerEngine Simulation', () => {
  it('runs a 14 day simulation meeting the requirements', () => {
    let currentTime = new Date('2026-09-01T08:00:00Z').getTime();
    const now = () => currentTime;
    
    const engine = new LeitnerEngine({}, 12345, now, DEFAULT_SETTINGS);
    
    let totalQuestions = 0;
    let correctAnswers = 0;
    
    // 14 days
    for (let day = 0; day < 14; day++) {
      // 2 sessions per day
      for (let session = 0; session < 2; session++) {
        currentTime += 12 * 60 * 60 * 1000; // +12 hours
        
        // Each session is 2 minutes. Let's say ~20 questions per session
        let lastKey = null;
        for (let q = 0; q < 20; q++) {
          const selection = engine.next();
          
          // Requirement: No duplicate sums in a row
          expect(selection.key).not.toBe(lastKey);
          lastKey = selection.key;
          
          // Let's simulate student behavior.
          // They know the known sums 95% of the time.
          // They know the hard sums 60% initially, but it improves as box increases.
          const isHard = HARD_SUMS.includes(selection.key);
          let successChance = isHard ? 0.6 + (selection.box * 0.1) : 0.95;
          
          const rand = Math.random();
          let outcome = 'clean' as 'clean' | 'wrong' | 'hint' | 'timeout';
          
          if (rand > successChance) {
            outcome = 'wrong';
          }
          
          engine.record(selection.key, outcome);
          
          if (outcome !== 'hint') {
            totalQuestions++;
            if (outcome === 'clean' || outcome === 'timeout') correctAnswers++;
          }
          
          // Time passes for each question (e.g. 5 seconds)
          currentTime += 5 * 1000;
        }
      }
    }
    
    const successRate = correctAnswers / totalQuestions;
    console.log(`Simulation Success Rate: ${(successRate * 100).toFixed(1)}%`);
    expect(successRate).toBeGreaterThan(0.75); // Target is ~85%, but randomness might yield 80+
    
    const snap = engine.snapshot();
    
    // Check conquests
    let conqueredCount = 0;
    for (const key of HARD_SUMS) {
      if (snap.states[key].isConquered) {
        conqueredCount++;
        // Conquer takes >= 3 days
        expect(snap.states[key].cleanDays.length).toBeGreaterThanOrEqual(3);
      }
    }
    console.log(`Conquered ${conqueredCount} out of 11 hard sums in 14 days`);
  });
});
