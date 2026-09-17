import type { Assets } from '../assets'
import { ZONES, zoneBlend, zoneProgress, type Zone } from '../content/zones'
import { starTileDataUrl } from './textures'

/**
 * The zone artwork behind the scene. Each zone is one 9:16 image shown at 125 %
 * of the viewport, sliding from its bottom edge to its top edge as the climb
 * progresses, so a single non-tiling picture still reads as continuous travel.
 */
export class Backdrop {
  private root: HTMLElement
  private layers: [HTMLElement, HTMLElement]
  private stars: HTMLElement
  private assets: Assets
  private shown: [Zone | null, Zone | null] = [null, null]
  private starScroll = 0

  constructor(root: HTMLElement, assets: Assets) {
    this.root = root
    this.assets = assets
    this.layers = [document.createElement('div'), document.createElement('div')]
    for (const layer of this.layers) {
      layer.className = 'bg-layer'
      this.root.appendChild(layer)
    }
    this.stars = document.createElement('div')
    this.stars.id = 'starfield'
    this.stars.style.backgroundImage = `url(${starTileDataUrl()})`
    this.root.appendChild(this.stars)
  }

  private paint(layer: HTMLElement, index: 0 | 1, zone: Zone): void {
    if (this.shown[index] === zone) return
    this.shown[index] = zone
    const url = this.assets.backgroundUrl(zone.id)
    layer.style.backgroundImage = url
      ? `url(${url})`
      : `linear-gradient(180deg, ${zone.gradient[1]}, ${zone.gradient[0]})`
  }

  /** A single still image, used by the start screen and the quiet screens. */
  showStill(url: string | null, dim = 0.55, blur = 6): void {
    this.stars.style.opacity = '0'
    const [a, b] = this.layers
    b.style.opacity = '0'
    a.style.opacity = '1'
    a.style.transform = 'translateY(-10%)'
    a.style.filter = `blur(${blur}px) brightness(${1 - dim})`
    a.style.backgroundImage = url ? `url(${url})` : 'linear-gradient(180deg, #3a2b52, #1b1430)'
    this.shown = [null, null]
  }

  showPlain(): void {
    this.showStill(null, 0.35, 0)
  }

  /** Follows the climb: `parallax` is the small extra push during a jump. */
  update(height: number, parallax = 0): void {
    const { current, next, mix } = zoneBlend(height)
    const [a, b] = this.layers
    this.paint(a, 0, current)
    this.paint(b, 1, next)
    a.style.filter = ''
    b.style.filter = ''

    const slide = (zone: Zone, layer: HTMLElement) => {
      const p = zone === current ? zoneProgress(height) : 0
      // 125 % tall, so 20 % of the layer travels past the viewport.
      const offset = -20 * (1 - p) - parallax * 0.6
      layer.style.transform = `translateY(${offset.toFixed(3)}%)`
    }
    slide(current, a)
    slide(next, b)
    a.style.opacity = String(1 - mix)
    b.style.opacity = String(mix)

    const spaceIndex = ZONES.length - 1
    const inSpace = current === ZONES[spaceIndex] || (next === ZONES[spaceIndex] && mix > 0)
    this.stars.style.opacity = inSpace ? String(current === ZONES[spaceIndex] ? 0.85 : mix * 0.85) : '0'
    if (inSpace) {
      this.starScroll = height * 6
      this.stars.style.backgroundPosition = `0 ${this.starScroll.toFixed(1)}px`
    }
  }
}
