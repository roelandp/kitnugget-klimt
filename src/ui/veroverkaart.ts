import type { App, Screen } from '../app'
import { el, topbar } from './dom'
import { HARD_SUMS } from '../engine/leitner'

export function veroverkaartScreen(app: App): Screen {
  app.backdrop.showPlain()
  
  const leitner = app.store.profile.leitner
  const states = leitner?.states ?? {}

  const grid = el('div.verover-grid', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '20px' } })

  let conquered = 0;

  for (const key of HARD_SUMS) {
    const s = states[key]
    let statusLabel = 'Nieuw'
    let className = 'nieuw'
    
    if (s) {
      if (s.isConquered) {
        statusLabel = 'Veroverd!'
        className = 'veroverd'
        conquered++;
      } else if (s.cleanDays && s.cleanDays.length > 0) {
        statusLabel = `Bijna (${s.cleanDays.length}/3)`
        className = 'bijna'
      } else if (s.box > 0) {
        statusLabel = 'Bezig'
        className = 'bezig'
      }
    }

    const card = el('div.card', { class: `verover-card ${className}`, style: { textAlign: 'center', padding: '15px' } },
      el('h3', { text: key.replace('x', ' × ') }),
      el('div.status', { text: statusLabel, style: { marginTop: '5px', fontSize: '14px', fontWeight: 'bold' } })
    )
    grid.appendChild(card)
  }

  const root = el('div.screen', {},
    topbar('Veroverkaart', () => app.go('menu')),
    el('div.scroller', {},
      el('div', { style: { padding: '20px', textAlign: 'center' } },
        el('h2', { text: `${conquered} van de 11 veroverd` }),
        el('p', { text: 'Elke sessie helpt je deze lastige sommen beter te onthouden!' })
      ),
      grid,
      el('button.btn', { style: { margin: '20px', width: 'calc(100% - 40px)' }, onclick: () => app.go('menu') }, 'Terug naar Menu')
    )
  )

  return { root }
}
