const fs = require('fs');
let code = fs.readFileSync('src/storage/schema.ts', 'utf8');

// We want to add migration logic inside `migrate(profile)`
const target = "return p as Profile";
const migrationCode = `
  // Migrate existing engine progress to leitner map if leitner is empty
  if (p.engine?.states && (!p.leitner || Object.keys(p.leitner.states || {}).length === 0)) {
    if (!p.leitner) p.leitner = {};
    p.leitner.states = {};
    const HARD_SUMS = ['3x3', '3x4', '3x6', '3x7', '3x8', '3x9', '4x4', '4x6', '4x7', '4x8', '4x9'];
    for (const key of HARD_SUMS) {
       const engState = p.engine.states[key];
       if (engState) {
         // Determine status
         let isSnel = false;
         let isGeo = false;
         if (engState.streakFast >= 3 && engState.fastDays && engState.fastDays.length >= 2) isGeo = true;
         if (engState.recent && engState.recent.length >= 2 && engState.recent.slice(-2).every(Boolean) && engState.rtEma !== null && engState.rtEma <= 5) isSnel = true;
         
         let box = 0;
         let conquered = false;
         let cleanDays = [];
         
         if (isGeo) {
           box = 4;
           conquered = true;
           cleanDays = ['migrated1', 'migrated2', 'migrated3'];
         } else if (isSnel) {
           box = 3;
           cleanDays = ['migrated1'];
         } else if (engState.seen > 0) {
           box = engState.lastCorrect ? 2 : 1;
         }
         
         p.leitner.states[key] = {
           key,
           box,
           lastSeenDay: null,
           history: [],
           cleanDays,
           isConquered: conquered,
           pendingReview: 0
         };
       }
    }
  }
`;

code = code.replace(target, migrationCode + "\n  " + target);
fs.writeFileSync('src/storage/schema.ts', code);
