import type { App, Screen } from '../app'
import { DAY_GOAL, isAsleep, roundsToday } from '../game/day'
import { el, metres } from './dom'

/** Start screen: the house cross-section, Kit Nugget waiting, and the numbers so far. */
export function menuScreen(app: App): Screen {
  const profile = app.store.profile
  app.backdrop.showStill(app.assets.titleUrl(), 0.5, 5)

  const asleep = isAsleep(profile)
  let woken = !asleep

  const cat = el('img.cat', { alt: 'Kit Nugget' }) as HTMLImageElement
  let poseName = asleep ? 'sleep' : 'beg'
  // The dresser hands back Kit Nugget with his hat on; until the art has
  // loaded it falls back to the plain sprite.
  const paint = () => {
    const src = app.dresser.dataUrl(poseName) ?? app.assets.poseUrl(poseName)
    if (src) cat.src = src
    cat.classList.toggle('hidden', !src)
  }
  const unsubscribe = app.dresser.subscribe(paint)
  paint()

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

  const play = el('button.btn.primary', { onclick: () => app.go('game'), style: { marginTop: '10px' } }, 'Vrij Klimmen')
  const train = el('button.btn.primary', { onclick: () => app.go('training'), style: { background: '#9b59b6' } }, 'Gericht Trainen (2 min)')
  const splitBtn = el('div', { style: { display: 'flex', gap: '8px', gridColumn: 'span 2' } },
    el('button.btn.small', { onclick: () => app.go('veroverkaart'), style: { flex: 1, padding: '0', fontSize: '14px' } }, 'Schatkaart'),
    el('button.btn.small', { onclick: () => app.go('tafelkaart'), style: { flex: 1, padding: '0', fontSize: '14px' } }, 'Tafels')
  )
  
  const grid = el(
    'div.menu-grid',
    {},
    el('button.btn.small', { onclick: () => app.go('toets') }, 'Toets'),
    splitBtn,
    el('button.btn.small', { onclick: () => app.go('verzameling') }, 'Kleding'),
    el('button.btn.small', { onclick: () => app.go('instellingen') }, 'Meer'),
  )

  const version = el('div.version', { text: `v ${__BUILD_ID__.slice(0, 16).replace('T', ' ')}` })
  const bottom = el(
    'div',
    { id: 'menu-bottom' },
    stats,
    paws,
    goalText,
    train,
    play,
    grid,
    version,
  )

  const root = el('div.screen', {}, art, bottom)

  const wake = () => {
    if (woken) return
    woken = true
    poseName = 'wake'
    paint()
    app.audio.wake()
    sleepNote.textContent = 'Goedemorgen! Klaar voor een ronde?'
    window.setTimeout(() => {
      poseName = 'beg'
      paint()
      sleepNote.classList.add('hidden')
    }, 1400)
  }
  if (asleep) {
    art.appendChild(sleepNote)
    root.addEventListener('pointerdown', wake, { once: true })
  }

  return { root, dispose: unsubscribe }
}
