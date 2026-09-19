import type { App, Screen } from '../app'
import { ITEMS, itemById } from '../content/items'
import { KRABPAAL_SLOTS, type KrabpaalSlot } from '../storage/schema'
import { el, topbar, clear } from './dom'

/**
 * Screen showing the Krabpaal decoration view and the collected items shelf.
 * Viggo can attach his unlocked items to platforms and spots on the krabpaal.
 */
export function verzamelingScreen(app: App): Screen {
  app.backdrop.showPlain()
  let selectedSlot: KrabpaalSlot | null = null

  const root = el('div.screen')
  const scroller = el('div.scroller')
  root.appendChild(topbar('Krabpaal & Spullen', () => app.go('menu')))
  root.appendChild(scroller)

  function render(): void {
    clear(scroller)
    const profile = app.store.profile
    const have = new Set(profile.collected)
    const decorations = { ...profile.decorations }

    // Map each equipped itemId to which slot it's in
    const itemToSlot = new Map<string, KrabpaalSlot>()
    for (const [s, itId] of Object.entries(decorations)) {
      if (itId) itemToSlot.set(itId, s as KrabpaalSlot)
    }

    // ---------- Krabpaal Card ----------
    const slotElements = KRABPAAL_SLOTS.map((slot) => {
      const equippedId = decorations[slot.id]
      const item = equippedId ? itemById(equippedId) : null
      const isSelected = selectedSlot === slot.id

      const slotBtn = el(
        'div.krabpaal-slot',
        {
          class: `${isSelected ? 'selected' : ''} ${item ? 'has-item' : 'empty'}`,
          onclick: () => {
            if (item) {
              // Clicking an occupied slot clears it or selects it
              selectedSlot = isSelected ? null : slot.id
            } else {
              selectedSlot = isSelected ? null : slot.id
            }
            render()
          },
        },
      )

      if (item) {
        const url = app.assets.itemUrl(item.id)
        const art = url
          ? el('img.krabpaal-item-img', { src: url, alt: item.naam })
          : el('div.krabpaal-fallback', { style: { background: item.color } })

        const removeBtn = el(
          'button.krabpaal-remove-btn',
          {
            type: 'button',
            'aria-label': 'Verwijder van krabpaal',
            onclick: (e: MouseEvent) => {
              e.stopPropagation()
              app.audio.play('tap')
              app.store.update((p) => {
                p.decorations[slot.id] = null
              })
              render()
            },
          },
          '✕',
        )

        slotBtn.appendChild(removeBtn)
        slotBtn.appendChild(art)
        slotBtn.appendChild(el('div.slot-name', { text: item.naam }))
        slotBtn.appendChild(el('div.slot-label', { text: slot.label }))
      } else {
        slotBtn.appendChild(el('div.slot-plus', { text: '+' }))
        slotBtn.appendChild(el('div.slot-label', { text: slot.label }))
        slotBtn.appendChild(el('div.slot-hint', { text: isSelected ? 'Kies item hieronder 👇' : 'Tik om te versieren' }))
      }

      return slotBtn
    })

    const krabpaalVisual = el(
      'div.krabpaal-visual',
      {},
      el('div.krabpaal-pole'),
      el('div.krabpaal-slots-grid', {}, ...slotElements),
    )

    const krabpaalCard = el(
      'div.card.krabpaal-card',
      {},
      el('h2', { text: '🐾 Krabpaal van Kit Nugget' }),
      el('p.muted', {
        style: { fontSize: '13px', margin: '4px 0 12px' },
        text: selectedSlot
          ? `Kies nu hieronder een item voor: ${KRABPAAL_SLOTS.find((s) => s.id === selectedSlot)?.label}`
          : 'Versier de krabpaal met je behaalde spullen! Deze zie je ook terug tijdens het klimmen.',
      }),
      krabpaalVisual,
    )

    // ---------- Shelf Card ----------
    const shelfSlots = ITEMS.map((item) => {
      const found = have.has(item.id)
      const slotOnKrabpaal = itemToSlot.get(item.id)
      const url = app.assets.itemUrl(item.id)
      const art = url
        ? el('img', { src: url, alt: item.naam })
        : el('div.fallback', { style: { background: found ? item.color : '#4b4258' } })

      const badge = slotOnKrabpaal
        ? el('div.equipped-badge', { text: `🐾 Op de paal` })
        : null

      const slotDiv = el(
        'div.slot',
        {
          class: `${found ? 'unlocked clickable' : 'locked'} ${slotOnKrabpaal ? 'equipped' : ''}`,
          onclick: () => {
            if (!found) return

            app.audio.play('item')
            app.store.update((p) => {
              if (slotOnKrabpaal) {
                // If already on krabpaal, remove it
                p.decorations[slotOnKrabpaal] = null
                selectedSlot = null
              } else if (selectedSlot) {
                // Place into explicitly selected slot
                p.decorations[selectedSlot] = item.id
                selectedSlot = null
              } else {
                // Find first free slot
                const freeSlot = KRABPAAL_SLOTS.find((s) => !p.decorations[s.id])
                if (freeSlot) {
                  p.decorations[freeSlot.id] = item.id
                } else {
                  // If all full, replace top slot
                  p.decorations['top'] = item.id
                }
              }
            })
            render()
          },
        },
        badge ?? el('span.placeholder-badge'),
        art,
        el('b', { text: found ? item.naam : '???' }),
        el('span', { text: found ? (slotOnKrabpaal ? 'Tik om te verwijderen' : 'Tik om te plaatsen') : `op ${item.height} m` }),
      )

      return slotDiv
    })

    const shelfCard = el(
      'div.card',
      {},
      el('h2', { text: `Verzameling (${have.size}/${ITEMS.length})` }),
      el('p.muted', {
        style: { fontSize: '13px', margin: '4px 0 10px' },
        text: 'Tik op een behaald item om het op de krabpaal te zetten of eraf te halen.',
      }),
      el('div.shelf', {}, ...shelfSlots),
    )

    scroller.appendChild(krabpaalCard)
    scroller.appendChild(shelfCard)
  }

  render()

  return { root }
}
