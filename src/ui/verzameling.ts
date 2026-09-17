import type { App, Screen } from '../app'
import { ITEMS } from '../content/items'
import { el, topbar } from './dom'

/** The shelf with eight spots. Not-yet-found items show as a silhouette. */
export function verzamelingScreen(app: App): Screen {
  app.backdrop.showPlain()
  const have = new Set(app.store.profile.collected)

  const slots = ITEMS.map((item) => {
    const found = have.has(item.id)
    const url = app.assets.itemUrl(item.id)
    const art = url
      ? el('img', { src: url, alt: item.naam })
      : el('div.fallback', { style: { background: found ? item.color : '#4b4258' } })
    return el(
      'div.slot',
      { class: found ? '' : 'locked' },
      art,
      el('b', { text: found ? item.naam : '???' }),
      el('span', { text: `op ${item.height} m` }),
    )
  })

  const root = el(
    'div.screen',
    {},
    topbar('Verzameling', () => app.go('menu')),
    el(
      'div.scroller',
      {},
      el('div.card', {}, el('h2', { text: `${have.size} van de ${ITEMS.length} gevonden` }), el('div.shelf', {}, ...slots)),
    ),
  )
  return { root }
}
