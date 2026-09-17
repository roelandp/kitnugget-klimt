import { Assets } from './assets'
import { Audio } from './audio/audio'
import { Engine } from './engine/engine'
import { Backdrop } from './scene/backdrop'
import { Store } from './storage/store'
import { clear } from './ui/dom'

export type ScreenId =
  | 'menu'
  | 'game'
  | 'result'
  | 'tafelkaart'
  | 'verzameling'
  | 'instellingen'
  | 'toets'

export interface Screen {
  root: HTMLElement
  dispose?: () => void
}

export type ScreenFactory = (app: App, payload?: unknown) => Screen

/** Holds everything long-lived and swaps one screen for another. */
export class App {
  readonly store = new Store()
  readonly assets: Assets
  readonly audio: Audio
  readonly backdrop: Backdrop
  readonly root: HTMLElement

  private screens = new Map<ScreenId, ScreenFactory>()
  private current: Screen | null = null
  private host: HTMLElement

  constructor(assets: Assets, mount: HTMLElement) {
    this.assets = assets
    this.audio = new Audio(assets)
    this.audio.setEffects(this.store.profile.settings.sound)
    this.audio.setMusic(this.store.profile.settings.music)

    this.root = mount
    const backdropEl = document.createElement('div')
    backdropEl.id = 'backdrop'
    this.host = document.createElement('div')
    this.host.style.cssText = 'position:absolute;inset:0;z-index:1'
    mount.appendChild(backdropEl)
    mount.appendChild(this.host)
    this.backdrop = new Backdrop(backdropEl, assets)

    // iOS needs a gesture before any sound; this is the earliest one there is.
    const unlock = () => {
      this.audio.unlock()
      if (this.store.profile.settings.music) this.audio.playMusic()
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
  }

  register(id: ScreenId, factory: ScreenFactory): void {
    this.screens.set(id, factory)
  }

  go(id: ScreenId, payload?: unknown): void {
    const factory = this.screens.get(id)
    if (!factory) return
    this.current?.dispose?.()
    clear(this.host)
    this.current = factory(this, payload)
    this.host.appendChild(this.current.root)
  }

  /** A fresh engine over the chosen tables, restoring everything learned so far. */
  makeEngine(tables = this.store.profile.settings.tables): Engine {
    return new Engine({ tables, snapshot: this.store.profile.engine })
  }

  saveEngine(engine: Engine): void {
    this.store.update((p) => {
      const snap = engine.snapshot()
      // Keep facts from tables that are not selected right now.
      p.engine = { ...p.engine, ...snap, states: { ...(p.engine.states ?? {}), ...snap.states } }
    })
  }
}
