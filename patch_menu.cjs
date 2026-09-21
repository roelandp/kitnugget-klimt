const fs = require('fs');
let code = fs.readFileSync('src/ui/menu.ts', 'utf8');

code = code.replace(
  "const play = el('button.btn.primary', { onclick: () => app.go('game') }, 'Speel')",
  "const play = el('button.btn.primary', { onclick: () => app.go('game'), style: { marginTop: '10px' } }, 'Vrij Klimmen')\n  const train = el('button.btn.primary', { onclick: () => app.go('training'), style: { background: '#9b59b6' } }, 'Gericht Trainen (2 min)')"
);

code = code.replace(
  "play,",
  "train,\n    play,"
);

code = code.replace(
  "el('button.btn.small', { onclick: () => app.go('toets') }, 'Toets')",
  "el('button.btn.small', { onclick: () => app.go('toets') }, 'Toets'),\n    el('button.btn.small', { onclick: () => app.go('veroverkaart') }, 'Schatkaart')"
);

fs.writeFileSync('src/ui/menu.ts', code);
