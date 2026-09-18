import type { App, Screen } from '../app'
import { DAY_GOAL, isAsleep, roundsToday } from '../game/day'
import { el, metres } from './dom'

/** Start screen: the house cross-section, Kit Nugget waiting, and the numbers so far. */
export function menuScreen(app: App): Screen {
  const profile = app.store.profile
  app.backdrop.showStill(app.assets.titleUrl(), 0.5, 5)

  const asleep = isAsleep(profile)
  let woken = !asleep

  const cat = el('img.cat', {
    alt: 'Kit Nugget',
    src: (asleep ? app.assets.poseUrl('sleep') : app.assets.poseUrl('beg')) ?? '',
  }) as HTMLImageElement
  if (!cat.getAttribute('src')) cat.classList.add('hidden')

  const sleepNote = el(
    'div.sleep-hint',
    { class: asleep ? '' : 'hidden' },
    'Kit Nugget heeft geslapen. Tik om hem wakker te maken.',
  )

  const done = roundsToday(profile)
  const paws = el(
    'div.paws',
    {},
    ...Array.from({ length: DAY_GOAL }, (_, i) => el('span.paw', { class: i < done ? 'on' : '', text: '🐾' })),
  )
  const goalText = el('div.muted', {
    style: { textAlign: 'center', fontSize: '13px', marginTop: '2px' },
    text:
      done >= DAY_GOAL
        ? 'Kit Nugget is moe en tevreden. Morgen weer!'
        : `Dagdoel: ${DAY_GOAL} rondes. Nog ${DAY_GOAL - done} te gaan.`,
  })

  const art = el(
    'div',
    { id: 'menu-art' },
    el(
      'div.title-wrap',
      {},
      el('h1', {}, 'KIT NUGGET', el('br'), 'KLIMT'),
      el('p', { text: 'Spring de tafels omhoog!' }),
    ),
    cat,
  )

  const stats = el(
    'div.stats',
    {},
    el('div.stat', {}, el('b', { text: `${metres(profile.totalHeight)} m` }), el('span', { text: 'Hoogte' })),
    el('div.stat', {}, el('b', { text: `${metres(profile.bestRound)} m` }), el('span', { text: 'Record' })),
    el('div.stat', {}, el('b', { text: String(profile.daysPlayed) }), el('span', { text: 'Dagen' })),
  )

  const play = el('button.btn.primary', { onclick: () => app.go('game') }, 'Speel')
  const grid = el(
    'div.menu-grid',
    {},
    el('button.btn.small', { onclick: () => app.go('toets') }, 'Toets'),
    el('button.btn.small', { onclick: () => app.go('tafelkaart') }, 'Tafels'),
    el('button.btn.small', { onclick: () => app.go('verzameling') }, 'Spullen'),
    el('button.btn.small', { onclick: () => app.go('instellingen') }, 'Meer'),
  )

  const bottom = el(
    'div',
    { id: 'menu-bottom' },
    stats,
    paws,
    goalText,
    play,
    grid,
  )

  // Outside the footer on purpose: it floats against the screen instead of
  // taking a row in the footer's flex flow.
  const version = el('div.version', { text: `v ${__BUILD_ID__.slice(0, 16).replace('T', ' ')}` })
  const root = el('div.screen', {}, art, bottom, version)

  const wake = () => {
    if (woken) return
    woken = true
    const url = app.assets.poseUrl('wake')
    if (url) cat.src = url
    app.audio.wake()
    sleepNote.textContent = 'Goedemorgen! Klaar voor een ronde?'
    window.setTimeout(() => {
      const beg = app.assets.poseUrl('beg')
      if (beg) cat.src = beg
      sleepNote.classList.add('hidden')
    }, 1400)
  }
  if (asleep) {
    art.appendChild(sleepNote)
    root.addEventListener('pointerdown', wake, { once: true })
  }

  return { root }
}
