const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

code = code.replace(
  "makeEngine(tables = this.store.profile.settings.tables): Engine {",
  "makeLeitner(): LeitnerEngine {\n    return new LeitnerEngine(this.store.profile.leitner ?? {})\n  }\n\n  saveLeitner(engine: LeitnerEngine): void {\n    this.store.update((p) => {\n      p.leitner = engine.snapshot()\n    })\n  }\n\n  makeEngine(tables = this.store.profile.settings.tables): Engine {"
);

// We also missed adding training and veroverkaart to ScreenId in patch_app_routes.cjs.
// Let's check `export type ScreenId =`
code = code.replace(
  "| 'toets'",
  "| 'toets'\n  | 'training'\n  | 'veroverkaart'"
);

// And we didn't add the imports and register them because they are registered in main.ts maybe?
// Wait, where are screens registered?
fs.writeFileSync('src/app.ts', code);
