import './style.css'
import { App } from './app'
import { Assets } from './assets'
import { gameScreen } from './ui/game'
import { instellingenScreen } from './ui/instellingen'
import { menuScreen } from './ui/menu'
import { resultScreen } from './ui/result'
import { tafelkaartScreen } from './ui/tafelkaart'
import { toetsScreen } from './ui/toets'
import { trainingScreen } from './ui/training'
import { veroverkaartScreen } from './ui/veroverkaart'
import { verzamelingScreen } from './ui/verzameling'

/**
 * Fresh code always wins. The service worker is registered with autoUpdate and
 * skipWaiting, so a new build takes over as soon as it is found; we also check
 * again whenever the app comes back to the foreground, which is how an installed
 * web app on an iPad usually returns.
 */
async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  // On a first install the worker claims the page straight away; only a *later*
  // takeover means new code arrived, and only then is a reload worth doing.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    const note = document.createElement('div')
    note.className = 'update-note'
    note.textContent = 'Nieuwe versie, even opnieuw laden'
    document.body.appendChild(note)
    window.setTimeout(() => location.reload(), 700)
  })
  try {
    const { registerSW } = await import('virtual:pwa-register')
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateSW(true)
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        const check = () => {
          if (document.visibilityState === 'visible') void registration.update()
        }
        // An installed app usually comes back by being reopened, not reloaded.
        document.addEventListener('visibilitychange', check)
        window.addEventListener('online', check)
        window.setInterval(check, 30 * 60 * 1000)
      },
    })
  } catch {
    // No service worker in dev, or blocked: the game runs fine without one.
  }
}

function syncAppHeight(): void {
  const mount = document.getElementById('app')
  if (!mount) return
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = Boolean((window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches

  const update = () => {
    // In iOS standalone PWA, WebKit subtracts the status bar from innerHeight/dvh.
    // Using screen.height (or screen.width in landscape) forces #app to fill the physical screen.
    if (isIOS && isStandalone) {
      const h = window.innerWidth > window.innerHeight
        ? Math.min(window.screen.width, window.screen.height)
        : Math.max(window.screen.width, window.screen.height)
      mount.style.height = `${h}px`
    } else {
      mount.style.height = `${window.innerHeight}px`
    }
  }

  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}

async function boot(): Promise<void> {
  const mount = document.getElementById('app')
  if (!mount) return
  syncAppHeight()
  const assets = await Assets.load()
  const app = new App(assets, mount)
  app.register('menu', menuScreen)
  app.register('game', gameScreen)
  app.register('result', resultScreen)
  app.register('tafelkaart', tafelkaartScreen)
  app.register('verzameling', verzamelingScreen)
  app.register('instellingen', instellingenScreen)
  app.register('toets', toetsScreen)
  app.register('training', trainingScreen)
  app.register('veroverkaart', veroverkaartScreen)
  app.go('menu')

  const splash = document.getElementById('splash')
  if (splash) {
    splash.classList.add('gone')
    window.setTimeout(() => splash.remove(), 400)
  }

  // No pinch zoom, no double tap zoom, no rubber banding during a round.
  document.addEventListener('gesturestart', (e) => e.preventDefault())
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault()
  }, { passive: false })

  void registerServiceWorker()
}

void boot()
