const fs = require('fs');
let code = fs.readFileSync('src/storage/schema.ts', 'utf8');

code = code.replace(
  "import type { EngineSnapshot } from '../engine/engine'",
  "import type { EngineSnapshot } from '../engine/engine'\nimport type { LeitnerSnapshot } from '../engine/leitner'"
);

code = code.replace(
  "engine: Partial<EngineSnapshot>",
  "engine: Partial<EngineSnapshot>\n  leitner: Partial<LeitnerSnapshot>"
);

code = code.replace(
  "engine: {},",
  "engine: {},\n    leitner: {},"
);

code = code.replace(
  "engine: v.engine && typeof v.engine === 'object' ? v.engine : {},",
  "engine: v.engine && typeof v.engine === 'object' ? v.engine : {},\n      leitner: v.leitner && typeof v.leitner === 'object' ? v.leitner : {},"
);

fs.writeFileSync('src/storage/schema.ts', code);
