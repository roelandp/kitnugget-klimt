const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

code = code.replace(
  "import { toetsScreen } from './ui/toets'",
  "import { toetsScreen } from './ui/toets'\nimport { trainingScreen } from './ui/training'\nimport { veroverkaartScreen } from './ui/veroverkaart'"
);

code = code.replace(
  "app.register('toets', toetsScreen)",
  "app.register('toets', toetsScreen)\n  app.register('training', trainingScreen)\n  app.register('veroverkaart', veroverkaartScreen)"
);

fs.writeFileSync('src/main.ts', code);
