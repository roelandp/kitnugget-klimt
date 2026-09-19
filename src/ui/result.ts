import type { App, Screen } from '../app'
import { itemById } from '../content/items'
import { zoneAt } from '../content/zones'
import { el, metres } from './dom'
import type { RoundSummary } from './game'

const STATUS_LABEL: Record<string, string> = {
  nieuw: 'nieuw',
  oefenen: 'oefenen',
  snel: 'snel',
  geautomatiseerd: 'zit erin',
}

/** End of a round: what it earned, and the three sums that still need work. */
export function resultScreen(app: App, payload?: unknown): Screen {
  const s = payload as RoundSummary
  app.backdrop.showStill(app.assets.backgroundUrl(zoneAt(s.totalHeight).id), 0.55, 8)

  const items = s.newItems
    .map((id) => itemById(id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it))

  const body = el(
    'div.scroller.above-footer',
    {},
    el(
      'div.card',
      {},
      el(
        'div.result-big',
        {},
        el('b', { text: `${metres(s.round.gain)} m` }),
        el('span', { text: s.isRecord ? 'Nieuw ronderecord!' : `Ronderecord: ${metres(s.bestRound)} m` }),
      ),
      el(
        'div.tally',
        {},
        el('div', {}, el('b', { text: String(s.round.fast) }), el('span', { text: 'Snel goed' })),
        el('div', {}, el('b', { text: String(s.round.slow) }), el('span', { text: 'Goed, traag' })),
        el('div', {}, el('b', { text: String(s.round.wrong) }), el('span', { text: 'Nog oefenen' })),
      ),
      el('div.row.spread', { style: { marginTop: '12px' } },
        el('span.muted', { text: 'Totale hoogte' }),
        el('b', { text: `${metres(s.totalHeight)} m` }),
      ),
      el('div.row.spread', {},
        el('span.muted', { text: 'Hoogste combo' }),
        el('b', { text: String(s.round.bestCombo) }),
      ),
      el('div.row.spread', {},
        el('span.muted', { text: 'Waar Kit Nugget nu is' }),
        el('b', { text: zoneAt(s.totalHeight).naam }),
      ),
    ),
    items.length
      ? el(
          'div.card',
          {},
          el('h2', { text: 'Nieuw gevonden' }),
          el('p.muted', {
            style: { fontSize: '13px', margin: '4px 0 10px' },
            text: 'Deze kun je bij Aankleden op z\'n hoofd zetten.',
          }),
          el(
            'div.row',
            { style: { flexWrap: 'wrap' } },
            ...items.map((it) =>
              el(
                'div',
                { style: { textAlign: 'center', width: '90px' } },
                app.assets.itemUrl(it.id)
                  ? el('img', { src: app.assets.itemUrl(it.id)!, style: { width: '64px', height: '64px', objectFit: 'contain' } })
                  : el('div.fallback', { style: { background: it.color, width: '64px', height: '64px', margin: '0 auto', borderRadius: '18px' } }),
                el('div', { style: { fontSize: '12px', fontWeight: '700' }, text: it.naam }),
              ),
            ),
          ),
        )
      : null,
    s.attention.length
      ? el(
          'div.card',
          {},
          el('h2', { text: 'Deze drie nog even oefenen' }),
          el(
            'div',
            {},
            ...s.attention.map((a) => el('span.chip', { text: `${a.label}  ·  ${STATUS_LABEL[a.status] ?? a.status}` })),
          ),
        )
      : null,
  )

  const footer = el(
    'div.footer',
    {},
    el('button.btn.primary', { onclick: () => app.go('game') }, 'Nog een ronde'),
    el('button.btn', { onclick: () => app.go('menu') }, 'Naar het startscherm'),
  )

  const root = el(
    'div.screen',
    {},
    el('div.topbar', {}, el('h1', { text: 'Ronde klaar' })),
    body,
    footer,
  )
  return { root }
}
