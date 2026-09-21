import { Assets } from './assets'
import { Audio } from './audio/audio'
import { sanitiseLook } from './content/looks'
import { Engine } from './engine/engine'
import { LeitnerEngine } from './engine/leitner'
import { Backdrop } from './scene/backdrop'
import { CatDresser } from './scene/dressup'
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
  | 'training'
  | 'veroverkaart'

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
  /** Composes Kit Nugget with his hat and fur pattern, for scene and menu alike. */
  readonly dresser: CatDresser
  readonly root: HTMLElement

  private screens = new Map<ScreenId, ScreenFactory>()
  private current: Screen | null = null
  private host: HTMLElement

  constructor(assets: Assets, mount: HTMLElement) {
    this.assets = assets
    this.audio = new Audio(assets)
    this.audio.setEffects(this.store.profile.settings.sound)
    this.audio.setMusic(this.store.profile.settings.music)

    const profile = this.store.profile
    this.dresser = new CatDresser(assets)
    this.dresser.setLook(sanitiseLook(profile.look, profile.collected, profile.totalHeight))

    this.root = mount
    const backdropEl = document.createElement('div')
    backdropEl.id = 'backdrop'
    this.host = document.createElement('div')
    this.host.style.cssText = 'position:absolute;inset:0;z-index:1'
    mount.appendChild(backdropEl)
    mount.appendChild(this.host)
    this.backdrop = new Backdrop(backdropEl, assets)

    // iOS needs a real gesture before any sound. Listen for several kinds and
    // keep listening until the context is genuinely running, because a context
    // created at an awkward moment can come back suspended.
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    const kick = () => {
      this.audio.unlock()
      if (this.store.profile.settings.music) this.audio.playMusic()
      if (!this.audio.ready) return
      for (const type of gestures) document.removeEventListener(type, kick)
    }
    for (const type of gestures) document.addEventListener(type, kick)
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
  makeLeitner(): LeitnerEngine {
    return new LeitnerEngine(this.store.profile.settings.tables, this.store.profile.leitner ?? {})
  }

  saveLeitner(engine: LeitnerEngine): void {
    this.store.update((p) => {
      p.leitner = engine.snapshot()
    })
  }

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
