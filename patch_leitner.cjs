const fs = require('fs');
let code = fs.readFileSync('src/engine/leitner.ts', 'utf8');

code = code.replace(
  "filter(s => !HARD_SUMS.includes(s.key) && s.key !== this.lastShown);",
  "filter(s => (!HARD_SUMS.includes(s.key) || s.box >= 3) && s.key !== this.lastShown);"
);

// We also need to fix cleanDays check.
// The rule for cleanDays: "op 3 verschillende dagen de eerste poging van die dag goed, zonder hint en zonder timeout".
// The problem with `state.lastSeenDay !== day` is that `lastSeenDay` might be `day` if they got it wrong earlier that day.
// So if they got it wrong, lastSeenDay = day. Then they get it right, lastSeenDay == day, so it doesn't count. This is correct! "eerste poging van die dag goed".
// BUT wait, what if they got it right, lastSeenDay != day (it was yesterday), so it counts. Then lastSeenDay = day. If they get it right again, lastSeenDay == day, so it doesn't count again. This is also correct!
// So the logic for cleanDays is completely correct!

fs.writeFileSync('src/engine/leitner.ts', code);
