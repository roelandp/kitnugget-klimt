import './style.css'
import { App } from './app'
import { Assets } from './assets'
import { gameScreen } from './ui/game'
import { instellingenScreen } from './ui/instellingen'
import { menuScreen } from './ui/menu'
import { resultScreen } from './ui/result'
import { tafelkaartScreen } from './ui/tafelkaart'
import { toetsScreen } from './ui/toets'
import { verzamelingScreen } from './ui/verzameling'

/**
 * Fresh code always wins. The service worker is registered with autoUpdate and
 * skipWaiting, so a new build takes over as soon as it is found; we also check
 * again whenever the app comes back to the foreground, which is how an installed
 * web app on an iPad usually returns.
 */
async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const { registerSW } = await import('virtual:pwa-register')
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        void update(true)
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        const check = () => {
          if (document.visibilityState === 'visible') void registration.update()
        }
        document.addEventListener('visibilitychange', check)
        window.addEventListener('online', check)
        window.setInterval(check, 60 * 60 * 1000)
      },
    })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A newer build has taken over; reload once so the running page matches it.
      if (sessionStorage.getItem('kn-reloaded') === '1') return
      sessionStorage.setItem('kn-reloaded', '1')
      location.reload()
    })
  } catch {
    // No service worker in dev, or blocked: the game runs fine without one.
  }
}

async function boot(): Promise<void> {
  const mount = document.getElementById('app')
  if (!mount) return
  const assets = await Assets.load()
  const app = new App(assets, mount)
  app.register('menu', menuScreen)
  app.register('game', gameScreen)
  app.register('result', resultScreen)
  app.register('tafelkaart', tafelkaartScreen)
  app.register('verzameling', verzamelingScreen)
  app.register('instellingen', instellingenScreen)
  app.register('toets', toetsScreen)
  app.go('menu')

  // No pinch zoom, no double tap zoom, no rubber banding during a round.
  document.addEventListener('gesturestart', (e) => e.preventDefault())
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault()
  }, { passive: false })

  void registerServiceWorker()
}

void boot()
