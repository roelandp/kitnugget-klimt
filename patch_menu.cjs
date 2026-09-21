const fs = require('fs');
let code = fs.readFileSync('src/ui/menu.ts', 'utf8');

code = code.replace(
  "const playBtn = el('button.btn.large', { onclick: () => app.go('game') }, 'Spelen')",
  "const playBtn = el('button.btn.large', { onclick: () => app.go('game') }, 'Vrij Klimmen')\n  const trainBtn = el('button.btn.large', { onclick: () => app.go('training'), style: { marginTop: '10px', background: '#9b59b6' } }, 'Gericht Trainen (2 min)')"
);

code = code.replace(
  "playBtn,",
  "trainBtn,\n        playBtn,"
);

code = code.replace(
  "el('button.icon-btn'",
  "el('button.btn.ghost', { onclick: () => app.go('veroverkaart'), style: { marginTop: '10px' } }, 'Veroverkaart'),\n        el('button.icon-btn'"
);

fs.writeFileSync('src/ui/menu.ts', code);
