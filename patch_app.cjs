const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

code = code.replace(
  "import { Engine } from './engine/engine'",
  "import { Engine } from './engine/engine'\nimport { LeitnerEngine } from './engine/leitner'"
);

code = code.replace(
  "makeEngine(): Engine {",
  "makeLeitner(): LeitnerEngine {\n    return new LeitnerEngine(this.store.profile.leitner ?? {})\n  }\n\n  saveLeitner(engine: LeitnerEngine): void {\n    this.store.update((p) => {\n      p.leitner = engine.snapshot()\n    })\n  }\n\n  makeEngine(): Engine {"
);

fs.writeFileSync('src/app.ts', code);
