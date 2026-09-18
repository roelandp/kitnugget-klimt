import type { App, Screen } from '../app'
import { el, topbar } from './dom'

const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Tables, sound, the timer style, and wiping progress. */
export function instellingenScreen(app: App): Screen {
  app.backdrop.showPlain()
  const settings = app.store.profile.settings

  const picks = el(
    'div.table-picks',
    {},
    ...ALL_TABLES.map((n) => {
      const button = el('button.pick', { class: settings.tables.includes(n) ? 'on' : '', text: String(n) })
      button.addEventListener('click', () => {
        const on = button.classList.toggle('on')
        app.store.update((p) => {
          const set = new Set(p.settings.tables)
          if (on) set.add(n)
          else set.delete(n)
          // Never leave the game with nothing to ask.
          p.settings.tables = set.size ? Array.from(set).sort((a, b) => a - b) : [n]
          if (!set.size) button.classList.add('on')
        })
      })
      return button
    }),
  )

  const toggle = (label: string, value: boolean, onChange: (on: boolean) => void): HTMLElement => {
    const sw = el('div.switch', { class: value ? 'on' : '' })
    const row = el('div.toggle-row', {}, el('span', { text: label }), sw)
    row.addEventListener('click', () => {
      const on = sw.classList.toggle('on')
      onChange(on)
    })
    return row
  }

  const timerRow = el('div.row', { style: { gap: '8px' } })
  const setTimer = (style: 'muis' | 'ring') => {
    app.store.update((p) => {
      p.settings.timerStyle = style
    })
    for (const b of timerRow.children) b.classList.toggle('on', b.getAttribute('data-style') === style)
  }
  for (const [style, label] of [
    ['muis', 'Muisje'],
    ['ring', 'Rustige ring'],
  ] as const) {
    timerRow.appendChild(
      el('button.pick', {
        'data-style': style,
        class: settings.timerStyle === style ? 'on' : '',
        style: { flex: '1', minWidth: '0' },
        text: label,
        onclick: () => setTimer(style),
      }),
    )
  }

  const soundReport = el('div.muted', {
    style: { marginTop: '10px', fontSize: '12px', lineHeight: '1.5' },
    text: 'Hoor je niets op een iPhone of iPad, kijk dan ook of de zijschakelaar niet op stil staat.',
  })
  const soundTest = el('button.btn', { style: { width: '100%' } }, 'Speel een piepje')
  soundTest.addEventListener('click', () => {
    soundReport.textContent = app.audio.selfTest()
  })

  let armed = false
  const wipe = el('button.btn', { style: { width: '100%' } }, 'Voortgang wissen')
  wipe.addEventListener('click', () => {
    if (!armed) {
      armed = true
      wipe.textContent = 'Zeker weten? Tik nog een keer'
      window.setTimeout(() => {
        armed = false
        wipe.textContent = 'Voortgang wissen'
      }, 4000)
      return
    }
    app.store.reset()
    app.go('menu')
  })

  const root = el(
    'div.screen',
    {},
    topbar('Instellingen', () => app.go('menu')),
    el(
      'div.scroller',
      {},
      el('div.card', {}, el('h2', { text: 'Tafels' }), picks, el('div.muted', { style: { marginTop: '8px', fontSize: '13px' }, text: 'Voor de toets op woensdag staan 5 tot en met 9 aan.' })),
      el(
        'div.card',
        {},
        el('h2', { text: 'Geluid' }),
        toggle('Geluidjes', settings.sound, (on) => {
          app.audio.setEffects(on)
          app.store.update((p) => {
            p.settings.sound = on
          })
        }),
        toggle('Achtergrondmuziek', settings.music, (on) => {
          app.audio.setMusic(on)
          if (on) app.audio.playMusic()
          app.store.update((p) => {
            p.settings.music = on
          })
        }),
      ),
      el('div.card', {}, el('h2', { text: 'Tijdsindicatie' }), timerRow),
      el('div.card', {}, el('h2', { text: 'Geluid testen' }), soundTest, soundReport),
      el(
        'div.card',
        {},
        el('h2', { text: 'Opnieuw beginnen' }),
        el('div.muted', { style: { marginBottom: '10px', fontSize: '13px' }, text: 'Dit wist de hoogte, het record, de spullen en alles wat Kit Nugget van de tafels weet.' }),
        wipe,
      ),
      el('div.build-line', { text: `Build ${__BUILD_ID__}` }),
    ),
  )
  return { root }
}
