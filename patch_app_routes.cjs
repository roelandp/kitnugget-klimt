const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

code = code.replace(
  "import { gameScreen, type RoundSummary } from './ui/game'",
  "import { gameScreen, type RoundSummary } from './ui/game'\nimport { trainingScreen } from './ui/training'\nimport { veroverkaartScreen } from './ui/veroverkaart'"
);

code = code.replace(
  "| { id: 'result'; param: RoundSummary }",
  "| { id: 'result'; param: RoundSummary }\n  | { id: 'training' }\n  | { id: 'veroverkaart' }"
);

code = code.replace(
  "case 'game':\n        this.screen = gameScreen(this)\n        break",
  "case 'game':\n        this.screen = gameScreen(this)\n        break\n      case 'training':\n        this.screen = trainingScreen(this)\n        break\n      case 'veroverkaart':\n        this.screen = veroverkaartScreen(this)\n        break"
);

fs.writeFileSync('src/app.ts', code);
