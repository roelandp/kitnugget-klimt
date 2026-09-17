import type { App, Screen } from '../app'
import { hintFor } from '../content/hints'
import { el, clear, seconds, topbar } from './dom'

const LEGEND: [string, string, string][] = [
  ['nieuw', 'nog niet gezien', '#4a4458'],
  ['oefenen', 'oefenen', '#d4803a'],
  ['snel', 'snel', '#a9d48a'],
  ['geautomatiseerd', 'zit erin', '#5fa863'],
]

/** The grid of every sum with its status. Doubles as the parent dashboard. */
export function tafelkaartScreen(app: App): Screen {
  app.backdrop.showPlain()
  const tables = app.store.profile.settings.tables
  const engine = app.makeEngine(tables)

  const detail = el('div.card')
  const grid = el('div.grid-table')

  const build = () => {
    clear(grid)
    grid.appendChild(el('div.head', { text: '' }))
    for (let b = 1; b <= 10; b++) grid.appendChild(el('div.head', { text: String(b) }))
    for (const a of tables) {
      grid.appendChild(el('div.head', { text: `${a}x` }))
      for (let b = 1; b <= 10; b++) {
        const key = `${a}x${b}`
        const status = engine.statusOf(key)
        const cell = el('button.cell', {
          class: status,
          'data-key': key,
          text: String(a * b),
          onclick: () => select(a, b, cell),
        })
        grid.appendChild(cell)
      }
    }
  }

  const select = (a: number, b: number, cell: HTMLElement) => {
    for (const other of grid.querySelectorAll('.cell.sel')) other.classList.remove('sel')
    cell.classList.add('sel')
    const key = `${a}x${b}`
    const state = engine.stateOf(key)
    const hint = hintFor(a, b)
    clear(detail)
    detail.append(
      el('h2', { text: `${a} x ${b} = ${a * b}` }),
      el('div.row.spread', {}, el('span.muted', { text: 'Status' }), el('b', { text: engine.statusOf(key) })),
      el('div.row.spread', {}, el('span.muted', { text: 'Gemiddelde tijd' }), el('b', { text: seconds(state.rtEma) })),
      el('div.row.spread', {}, el('span.muted', { text: 'Tijdsgrens' }), el('b', { text: seconds(engine.limitOf(key)) })),
      el(
        'div.row.spread',
        {},
        el('span.muted', { text: 'Goed / fout' }),
        el('b', { text: `${state.correct} / ${state.wrong}` }),
      ),
      el('div', { style: { marginTop: '12px', color: '#ffd27d', fontWeight: '800' }, text: hint.tip }),
      el('div', { style: { marginTop: '4px', fontSize: '18px', fontWeight: '800' }, text: hint.steps.join('  =  ') }),
    )
    if (hint.extra) {
      detail.appendChild(el('div.muted', { style: { marginTop: '6px', fontSize: '13px' }, text: hint.extra }))
    }
  }

  build()
  clear(detail)
  detail.append(el('h2', { text: 'Tik op een som' }), el('div.muted', { text: 'Dan zie je de tijd, de fouten en de steunsom.' }))

  const legend = el(
    'div.legend',
    {},
    ...LEGEND.map(([, label, colour]) =>
      el('span', {}, el('i', { style: { background: colour } }), label),
    ),
  )

  const root = el(
    'div.screen',
    {},
    topbar('Tafelkaart', () => app.go('menu')),
    el('div.scroller', {}, el('div.card', {}, grid, legend), detail),
  )
  return { root }
}
