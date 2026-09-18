import type { App, Screen } from '../app'
import type { Engine } from '../engine/engine'
import { buildFacts } from '../engine/facts'
import { makeRng } from '../engine/rng'
import type { Fact } from '../engine/types'
import type { TestResult } from '../storage/schema'
import { el, clear, topbar } from './dom'
import { Numpad } from './numpad'

const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const DEFAULT_COUNT = 40
const DEFAULT_SECONDS = 120

/**
 * Test mode, shaped like the one at school: a fixed number of sums against the
 * clock, no hints, no time limit per sum and no feedback until the end. The
 * answers still feed the engine, and every correct one is worth a metre.
 */
export function toetsScreen(app: App): Screen {
  app.backdrop.showPlain()
  const host = el('div.screen')
  let numpad: Numpad | null = null
  let ticker = 0

  const dispose = () => {
    numpad?.dispose()
    numpad = null
    clearInterval(ticker)
  }

  // ---------- setup ----------

  function showSetup(): void {
    dispose()
    clear(host)
    const settings = app.store.profile.settings
    const chosen = new Set(settings.tables)
    let count = DEFAULT_COUNT
    let limit = DEFAULT_SECONDS

    const picks = el(
      'div.table-picks',
      {},
      ...ALL_TABLES.map((n) => {
        const b = el('button.pick', { class: chosen.has(n) ? 'on' : '', text: String(n) })
        b.addEventListener('click', () => {
          if (b.classList.toggle('on')) chosen.add(n)
          else chosen.delete(n)
          if (chosen.size === 0) {
            chosen.add(n)
            b.classList.add('on')
          }
        })
        return b
      }),
    )

    const stepper = (label: string, value: number, options: number[], set: (v: number) => void): HTMLElement => {
      const row = el('div.row', { style: { gap: '8px', flexWrap: 'wrap' } })
      for (const option of options) {
        row.appendChild(
          el('button.pick', {
            class: option === value ? 'on' : '',
            style: { flex: '1', minWidth: '64px' },
            text: label === 'tijd' ? `${option / 60} min` : String(option),
            onclick: () => {
              set(option)
              for (const child of row.children) child.classList.remove('on')
              const target = Array.from(row.children).find((c) => c.textContent === (label === 'tijd' ? `${option / 60} min` : String(option)))
              target?.classList.add('on')
            },
          }),
        )
      }
      return row
    }

    const history = app.store.profile.tests.slice().reverse()

    host.append(
      topbar('Toets', () => app.go('menu')),
      el(
        'div.scroller',
        {},
        el('div.card', {}, el('h2', { text: 'Tafels' }), picks),
        el('div.card', {}, el('h2', { text: 'Aantal sommen' }), stepper('aantal', count, [20, 30, 40, 50], (v) => (count = v))),
        el('div.card', {}, el('h2', { text: 'Totale tijd' }), stepper('tijd', limit, [60, 120, 180, 300], (v) => (limit = v))),
        el('div.card', {}, el('div.muted', { style: { fontSize: '13px' }, text: 'Geen hints en geen tijd per som. Je ziet pas aan het eind wat goed was. Elk goed antwoord is 1 meter voor Kit Nugget.' })),
        el('button.btn.primary', { style: { width: '100%' }, onclick: () => showRun(Array.from(chosen).sort((a, b) => a - b), count, limit) }, 'Start de toets'),
        history.length
          ? el(
              'div.card',
              { style: { marginTop: '14px' } },
              el('h2', { text: 'Vorige toetsen' }),
              ...history.map((t) =>
                el(
                  'div.row.spread',
                  { style: { padding: '4px 0' } },
                  el('span.muted', { text: new Date(t.at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) }),
                  el('b', { text: `${t.correct}/${t.count}` }),
                ),
              ),
            )
          : el('div', {}),
      ),
    )
  }

  // ---------- run ----------

  function showRun(tables: number[], count: number, limitSeconds: number): void {
    dispose()
    clear(host)
    const engine: Engine = app.makeEngine(tables)
    const rng = makeRng(Date.now() & 0x7fffffff)
    const pool = buildFacts(tables)
    // Shuffle, then walk the list, so no sum is asked twice before all have been.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i)
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    const asked: Fact[] = []
    for (let i = 0; i < count; i++) asked.push(pool[i % pool.length])

    let index = 0
    let typed = ''
    let shownAt = performance.now()
    const wrong: string[] = []
    const skipped: string[] = []
    let correct = 0
    const started = Date.now()

    const sum = el('div', { id: 'test-sum' })
    const answer = el('div', { id: 'answer-box', style: { textAlign: 'center', minHeight: '1.2em' } })
    const bar = el('i')
    const progress = el('div.progressbar', {}, bar)
    const clockLabel = el('div.row.spread', {}, el('span.muted', { text: 'Som 1' }), el('b', { text: '' }))

    const finish = () => {
      clearInterval(ticker)
      for (let i = index; i < asked.length; i++) skipped.push(`${asked[i].a} x ${asked[i].b}`)
      const result: TestResult = {
        at: Date.now(),
        tables,
        count,
        seconds: Math.min(limitSeconds, Math.round((Date.now() - started) / 1000)),
        correct,
        wrong,
        skipped,
      }
      app.store.update((p) => {
        p.tests = [...p.tests, result].slice(-10)
        p.totalHeight += correct
      })
      app.saveEngine(engine)
      showResult(result)
    }

    const show = () => {
      if (index >= asked.length) {
        finish()
        return
      }
      const fact = asked[index]
      sum.textContent = `${fact.a} x ${fact.b}`
      answer.textContent = ''
      typed = ''
      shownAt = performance.now()
      clockLabel.firstElementChild!.textContent = `Som ${index + 1} van ${count}`
      bar.style.width = `${(index / count) * 100}%`
    }

    const submit = () => {
      if (typed.length === 0) return
      const fact = asked[index]
      const value = Number(typed)
      const rt = (performance.now() - shownAt) / 1000
      engine.record(fact, value, rt)
      if (value === fact.a * fact.b) correct += 1
      else wrong.push(`${fact.a} x ${fact.b}`)
      index += 1
      show()
    }

    numpad = new Numpad({
      onDigit: (d) => {
        app.audio.play('tap')
        if (typed.length >= 3) typed = ''
        typed += String(d)
        answer.textContent = typed
      },
      onClear: () => {
        typed = ''
        answer.textContent = ''
      },
      onOk: submit,
    })

    const skip = el('button.btn.small.ghost', {
      onclick: () => {
        skipped.push(`${asked[index].a} x ${asked[index].b}`)
        index += 1
        show()
      },
    }, 'Overslaan')

    host.append(
      el('div.topbar', {}, el('button.btn.small.ghost', { onclick: () => app.go('menu') }, 'Stop'), el('h1', { text: 'Toets' }), skip),
      el(
        'div',
        { id: 'toets-panel' },
        clockLabel,
        progress,
        sum,
        answer,
        numpad.root,
      ),
    )
    show()

    ticker = window.setInterval(() => {
      const left = limitSeconds - Math.round((Date.now() - started) / 1000)
      clockLabel.lastElementChild!.textContent = `${Math.max(0, left)} s`
      if (left <= 0) finish()
    }, 250)
  }

  // ---------- result ----------

  function showResult(result: TestResult): void {
    dispose()
    clear(host)
    host.append(
      topbar('Toets klaar', () => app.go('menu')),
      el(
        'div.scroller.above-footer',
        {},
        el(
          'div.card',
          {},
          el('div.result-big', {}, el('b', { text: `${result.correct}/${result.count}` }), el('span', { text: `in ${result.seconds} seconden` })),
          el('div.row.spread', { style: { marginTop: '10px' } }, el('span.muted', { text: 'Kit Nugget klom' }), el('b', { text: `${result.correct} m` })),
        ),
        result.wrong.length
          ? el('div.card', {}, el('h2', { text: 'Fout' }), el('div', {}, ...result.wrong.map((w) => el('span.chip', { text: w }))))
          : el('div.card', {}, el('h2', { text: 'Alles goed!' })),
        result.skipped.length
          ? el('div.card', {}, el('h2', { text: 'Niet gehaald' }), el('div', {}, ...result.skipped.map((w) => el('span.chip', { text: w }))))
          : el('div', {}),
      ),
      el(
        'div.footer',
        {},
        el('button.btn.primary', { onclick: showSetup }, 'Nog een toets'),
        el('button.btn', { onclick: () => app.go('menu') }, 'Naar het startscherm'),
      ),
    )
  }

  showSetup()
  return { root: host, dispose }
}
