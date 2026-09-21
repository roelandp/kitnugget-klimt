const fs = require('fs');
let code = fs.readFileSync('src/ui/training.ts', 'utf8');

code = code.replace("import { ITEMS } from '../content/items'\n", "");
code = code.replace("import { noteRound } from '../game/day'\n", "");
code = code.replace("const startHeight = height\n", "");
code = code.replace("let shownAt = 0\n", "");
code = code.replace("shownAt = performance.now()", "");
code = code.replace("let targetAnswer = selection.fact.a * selection.fact.b", "let targetAnswer = selection.a * selection.b");

fs.writeFileSync('src/ui/training.ts', code);
