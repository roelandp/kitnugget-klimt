const fs = require('fs');

let vk = fs.readFileSync('src/ui/veroverkaart.ts', 'utf8');
vk = vk.replace(/\\`/g, '`');
vk = vk.replace(/\\\$/g, '$');
fs.writeFileSync('src/ui/veroverkaart.ts', vk);

let tr = fs.readFileSync('src/ui/training.ts', 'utf8');
// To fix "Declaration or statement expected" at end of training.ts
// maybe I appended `\n  return {` and it broke the nesting.
// Let's check training.ts
