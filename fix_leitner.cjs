const fs = require('fs');
let ts = fs.readFileSync('src/engine/leitner.ts', 'utf8');
ts = ts.replace("const day = this.currentDay();", "");
ts = ts.replace("const wasCorrect = outcome === 'clean' || outcome === 'hint' || outcome === 'timeout';", "");
ts = ts.replace("const attemptsToday = state.history.filter((_, i) => state.lastSeenDay === day).length;", "");
fs.writeFileSync('src/engine/leitner.ts', ts);

let testTs = fs.readFileSync('src/engine/leitner.test.ts', 'utf8');
testTs = testTs.replace("import { describe, it, expect, vi } from 'vitest';", "import { describe, it, expect } from 'vitest';");
// Let's change the type of outcome to exactly match what engine expects
testTs = testTs.replace(
  "let outcome: 'clean' | 'wrong' | 'hint' | 'timeout' = 'clean';",
  "let outcome = 'clean' as 'clean' | 'wrong' | 'hint' | 'timeout';"
);
fs.writeFileSync('src/engine/leitner.test.ts', testTs);
