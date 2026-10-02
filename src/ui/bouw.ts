import type { App, Screen } from '../app'
import { canSpeak, speak } from '../audio/speak'
import { LESSONS, blurbFor, masteryLabel } from '../content/bouw'
import { dayKey } from '../engine/facts'
import { suggestTable, tableMastery } from '../game/bouw'
import { el, clear, topbar } from './dom'
import { LegoPlate } from './lego'

const PICKABLE = [2, 3, 4, 5, 6, 7, 8, 9, 10]
const WEEK_DAYS = 7

function daysSince(day: string | null, now = Date.now()): number {
  if (!day) return 0
  const [y, m, d] = day.split('-').map(Number)
  const start = new Date(y, m - 1, d).getTime()
  const today = new Date(dayKey(now).replace(/-/g, '/')).getTime()
  return Math.max(0, Math.round((today - start) / 86400000))
}

/**
 * Hub of the Bouwen variant: one table a week, seven short lessons that build
 * it from Lego anchors, and a quiet view of which tables already sit well.
 */
export function bouwScreen(app: App): Screen {
  app.backdrop.showPlain()
  const host = el('div.scroller.above-footer')
  const footer = el('div.footer')
  const root = el('div.screen', {}, topbar('Bouwen', () => app.go('menu')), host, footer)
  const plates: LegoPlate[] = []

  const states = () => (app.store.profile.leitner?.states ?? {}) as Record<string, { box: number }>
  const clickedTables = () =>
    Object.entries(app.store.profile.bouw.done)
      .filter(([, list]) => LESSONS.every((l) => list.includes(l.id)))
      .map(([k]) => Number(k))

  let picking = app.store.profile.bouw.weekTable === null

  function chooseTable(t: number): void {
    app.store.update((p) => {
      if (p.bouw.weekTable !== t) {
        p.bouw.weekTable = t
        p.bouw.weekStart = dayKey(Date.now())
      }
    })
    picking = false
    build()
  }

  function picker(): HTMLElement {
    const suggestion = suggestTable(app.store.profile.settings.tables, states(), clickedTables())
    const clicked = clickedTables()
    const rows = PICKABLE.map((t) => {
      const score = tableMastery(t, states())
      const bar = el('i', { style: { width: `${Math.round((score ?? 0) * 100)}%` } })
      return el(
        'button.bouw-pick',
        { type: 'button', class: t === app.store.profile.bouw.weekTable ? 'on' : '', onclick: () => chooseTable(t) },
        el('b', { text: String(t) }),
        el(
          'div.bouw-pick-mid',
          {},
          el('div.bouw-meter', {}, bar),
          el('small', { text: masteryLabel(score) }),
        ),
        clicked.includes(t) ? el('span.bouw-star', { text: '⭐' }) : t === suggestion ? el('span.bouw-tip', { text: 'Tip' }) : null,
      )
    })
    return el(
      'div.card',
      {},
      el('h2', { text: 'Kies je tafel van de week' }),
      el('p.muted', {
        style: { margin: '0 0 10px', fontSize: '14px' },
        text: 'Een tafel per week, dan zit hij echt. De balk laat zien hoe goed hij al gaat bij het klimmen en trainen.',
      }),
      el('div.bouw-picks', {}, ...rows),
    )
  }

  function lessonList(t: number): HTMLElement {
    const done = app.store.profile.bouw.done[String(t)] ?? []
    const nextId = LESSONS.find((l) => !done.includes(l.id))?.id
    return el(
      'div.bouw-lessons',
      {},
      ...LESSONS.map((l, i) =>
        el(
          'button.bouw-lesson',
          {
            type: 'button',
            class: `${done.includes(l.id) ? 'done' : ''} ${l.id === nextId ? 'next' : ''}`,
            onclick: () => app.go('bouwles', { table: t, lesson: l.id }),
          },
          el('span.bouw-lesson-icon', { text: l.icon }),
          el('div', {}, el('b', { text: `${i + 1}. ${l.title}` }), el('small', { text: blurbFor(l, t) })),
          el('span.bouw-lesson-check', { text: done.includes(l.id) ? '🐾' : '' }),
        ),
      ),
    )
  }

  function build(): void {
    clear(host)
    clear(footer)
    for (const p of plates) p.dispose()
    plates.length = 0
    const bouw = app.store.profile.bouw
    const t = bouw.weekTable

    if (picking || t === null) {
      host.appendChild(picker())
      if (t !== null) footer.appendChild(el('button.btn', { type: 'button', onclick: () => { picking = false; build() } }, 'Terug naar de tafel van ' + t))
      else footer.appendChild(el('div.muted', { style: { textAlign: 'center', fontSize: '14px' }, text: 'Tik op een tafel om te beginnen.' }))
      return
    }

    const done = bouw.done[String(t)] ?? []
    const day = daysSince(bouw.weekStart) + 1
    const allDone = LESSONS.every((l) => done.includes(l.id))

    // A small plate of the table itself as the header picture: 3 bricks of t.
    const hero = new LegoPlate()
    plates.push(hero)
    hero.root.classList.add('bouw-hero-plate')

    const weekLine =
      day > WEEK_DAYS
        ? 'Je tafelweek is om. Kies een nieuwe tafel, of bouw nog even door.'
        : `Dag ${day} van je tafelweek.`
    host.append(
      el(
        'div.card.bouw-week',
        {},
        el(
          'div.row',
          { style: { alignItems: 'flex-start' } },
          el('div.bouw-big', {}, el('small', { text: 'Tafel van' }), el('b', { text: String(t) })),
          el(
            'div',
            { style: { flex: '1' } },
            el('div', { style: { fontWeight: '800' }, text: allDone ? `De tafel van ${t} klikt! ⭐` : `${done.length} van ${LESSONS.length} lessen gebouwd` }),
            el('div.muted', { style: { fontSize: '14px', marginTop: '2px' }, text: weekLine }),
            el('button.btn.small.ghost', { type: 'button', style: { marginTop: '8px' }, onclick: () => { picking = true; build() } }, 'Andere tafel'),
          ),
        ),
        hero.root,
        el('div.muted', { style: { fontSize: '13px', textAlign: 'center' }, text: `3 x ${t} = 3 stenen van ${t} nopjes` }),
      ),
      lessonList(t),
    )

    const own = Object.entries(bouw.rhymes).filter(([k]) => k.endsWith(`x${t}`) || k.startsWith(`${t}x`))
    if (own.length) {
      host.appendChild(
        el(
          'div.card',
          {},
          el('h2', { text: 'Jouw rijmpjes' }),
          ...own.map(([k, text]) =>
            el('button.bouw-own', { type: 'button', onclick: () => speak(text) }, el('b', { text: k.replace('x', ' x ') }), el('span', { text: text })),
          ),
        ),
      )
    }

    if (canSpeak()) {
      const sw = el('div.switch', { class: bouw.speak ? 'on' : '' })
      const row = el('div.toggle-row', {}, el('span', { text: 'Voorlezen' }), sw)
      row.addEventListener('click', () => {
        app.store.update((p) => {
          p.bouw.speak = !p.bouw.speak
        })
        sw.classList.toggle('on', app.store.profile.bouw.speak)
      })
      host.appendChild(el('div.card', {}, row))
    }

    host.appendChild(
      el(
        'details.card.bouw-why',
        {},
        el('summary', { text: 'Waarom bouwen? (voor ouders)' }),
        el('p', {
          text:
            'Keer wordt hier altijd "stenen van": 4 x 6 is 4 stenen van 6 nopjes. Door de plaat te draaien zie je dat 4 x 6 en 6 x 4 even groot zijn. ' +
            'De lastige sommen worden niet gestampt maar gebouwd vanuit ankers: 1, 2, 5 en 10 stenen. 6 x 7 is 5 x 7 en nog een steen, 9 x 6 is 10 x 6 min een steen, 8 x 8 is drie keer verdubbelen. ' +
            'Er loopt geen klok en er is geen muisje: rustig nadenken mag. Overgooien en rijmpjes gebruiken ritme en taal, waar een talig kind sterk in is.',
        }),
      ),
    )

    const next = LESSONS.find((l) => !done.includes(l.id))
    footer.appendChild(
      el(
        'button.btn.primary',
        { type: 'button', onclick: () => app.go('bouwles', { table: t, lesson: next?.id ?? 'proef' }) },
        next ? `${next.icon} Bouw verder: ${next.title}` : '🏆 Nog een bouwproef',
      ),
    )

    requestAnimationFrame(() => hero.render({ rows: 3, cols: t, labels: 'all' }))
  }

  build()
  return {
    root,
    dispose() {
      for (const p of plates) p.dispose()
    },
  }
}
