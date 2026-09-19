import type { Assets } from '../assets'
import { EMPTY_LOOK, hatById, type Look } from '../content/looks'
import { DRAWN_HATS, paintPattern } from './dressart'
import { placeholderCatCanvas } from './textures'

/**
 * Where the head sits in each pose, measured on the delivered sprites.
 * `head` is the top of the skull between the ears, `face` sits between the
 * eyes, both as fractions of the sprite. `rot` is how far the head leans.
 */
interface Anchor {
  headW: number
  rot: number
  head: { x: number; y: number }
  face: { x: number; y: number }
  /** The eye line leans more than the skull in a three-quarter view. */
  faceRot: number
}

const POLE_POSE: Anchor = {
  headW: 0.5,
  rot: 14,
  head: { x: 0.615, y: 0.135 },
  face: { x: 0.606, y: 0.236 },
  faceRot: 28,
}

const ANCHORS: Record<string, Anchor> = {
  hang: POLE_POSE,
  surprised: POLE_POSE,
  happy: POLE_POSE,
  jump: { headW: 0.52, rot: 8, head: { x: 0.55, y: 0.05 }, face: { x: 0.416, y: 0.157 }, faceRot: 8 },
  beg: { headW: 0.58, rot: 13, head: { x: 0.51, y: 0.065 }, face: { x: 0.393, y: 0.163 }, faceRot: 12 },
  sleep: { headW: 0.5, rot: -38, head: { x: 0.43, y: 0.055 }, face: { x: 0.4, y: 0.335 }, faceRot: -43 },
}

/** The head of the code-drawn stand-in kitten, for when a sprite is missing. */
const PLACEHOLDER_ANCHOR: Anchor = {
  headW: 0.58,
  rot: 0,
  head: { x: 0.672, y: 0.062 },
  face: { x: 0.672, y: 0.17 },
  faceRot: 0,
}

/** Transparent margin around the sprite, so a tall hat is never clipped. */
const PAD_TOP = 0.36
const PAD_SIDE = 0.15
const PAD_BOTTOM = 0.04

export interface Dressed {
  canvas: HTMLCanvasElement
  /** Where the original sprite sits inside the padded canvas, in fractions. */
  inset: { x: number; y: number; w: number; h: number }
  /** Bumped whenever the pixels changed. */
  version: number
}

interface Entry extends Dressed {
  base: CanvasImageSource | null
  anchor: Anchor
  spriteW: number
  spriteH: number
  padX: number
  padY: number
  dirty: boolean
}

/**
 * Composes Kit Nugget with his hat and fur pattern into one canvas per pose.
 * The scene turns that canvas into a texture, the menu turns it into an image,
 * so both show the same outfit.
 */
export class CatDresser {
  private assets: Assets
  private current: Look = { ...EMPTY_LOOK }
  private entries = new Map<string, Entry>()
  private hatImages = new Map<string, HTMLImageElement | null>()
  private listeners = new Set<() => void>()

  constructor(assets: Assets) {
    this.assets = assets
  }

  get look(): Look {
    return this.current
  }

  setLook(look: Look): void {
    if (look.hat === this.current.hat && look.pattern === this.current.pattern) return
    this.current = { hat: look.hat, pattern: look.pattern }
    this.invalidate()
  }

  /** Runs whenever the composed art changed, e.g. a sprite finished loading. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dressed(pose: string): Dressed {
    const entry = this.entry(pose)
    if (entry.dirty) this.compose(entry)
    return entry
  }

  /** The pose as a trimmed PNG for plain `<img>` use. Null while the art loads. */
  dataUrl(pose: string): string | null {
    const entry = this.entry(pose)
    if (!entry.base) return null
    if (entry.dirty) this.compose(entry)
    return trim(entry.canvas).toDataURL('image/png')
  }

  // ---------- internals ----------

  private invalidate(): void {
    for (const entry of this.entries.values()) entry.dirty = true
    for (const fn of this.listeners) fn()
  }

  private entry(pose: string): Entry {
    const found = this.entries.get(pose)
    if (found) return found

    const resolved = this.resolve(pose)
    const spriteW = resolved.w
    const spriteH = resolved.h
    const padX = Math.round(spriteW * PAD_SIDE)
    const padY = Math.round(spriteH * PAD_TOP)
    const canvas = document.createElement('canvas')
    canvas.width = spriteW + padX * 2
    canvas.height = spriteH + padY + Math.round(spriteH * PAD_BOTTOM)
    const entry: Entry = {
      canvas,
      inset: {
        x: padX / canvas.width,
        y: padY / canvas.height,
        w: spriteW / canvas.width,
        h: spriteH / canvas.height,
      },
      version: 0,
      base: null,
      anchor: resolved.url ? (ANCHORS[resolved.pose] ?? POLE_POSE) : PLACEHOLDER_ANCHOR,
      spriteW,
      spriteH,
      padX,
      padY,
      dirty: true,
    }
    this.entries.set(pose, entry)

    if (resolved.url) {
      const img = new Image()
      img.onload = () => {
        entry.base = img
        entry.dirty = true
        this.compose(entry)
        for (const fn of this.listeners) fn()
      }
      img.src = resolved.url
    } else {
      const pole = this.assets.pole
      entry.base = placeholderCatCanvas(resolved.pose, pole.left, pole.right)
    }
    return entry
  }

  /** Maps a pose name onto the sprite that should be drawn for it. */
  private resolve(pose: string): { pose: string; url: string | null; w: number; h: number } {
    let name = pose
    if (!this.assets.sprite(name) && name === 'wake') name = this.assets.sprite('happy') ? 'happy' : 'beg'
    const info = this.assets.sprite(name)
    if (info) return { pose: name, url: this.assets.url(info.file), w: info.w, h: info.h }
    return { pose: name, url: null, w: 515, h: 768 }
  }

  private hatImage(id: string): HTMLImageElement | null {
    if (this.hatImages.has(id)) {
      const cached = this.hatImages.get(id)!
      return cached && cached.naturalWidth > 0 ? cached : null
    }
    const url = this.assets.itemUrl(id)
    if (!url) {
      this.hatImages.set(id, null)
      return null
    }
    const img = new Image()
    img.onload = () => this.invalidate()
    img.src = url
    this.hatImages.set(id, img)
    return null
  }

  private compose(entry: Entry): void {
    const ctx = entry.canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height)
    entry.dirty = false
    if (!entry.base) return
    ctx.drawImage(entry.base, entry.padX, entry.padY, entry.spriteW, entry.spriteH)
    if (this.current.pattern) this.applyPattern(ctx, entry, this.current.pattern)
    if (this.current.hat) this.applyHat(ctx, entry, this.current.hat)
    entry.version++
  }

  private applyPattern(ctx: CanvasRenderingContext2D, entry: Entry, id: string): void {
    const { width, height } = entry.canvas
    ctx.save()
    // source-atop keeps the paint inside the silhouette that is already there.
    ctx.globalCompositeOperation = 'source-atop'
    paintPattern(ctx, id, width, height)
    ctx.restore()

    // Draw the face back over the pattern, feathered, so eyes and mouth stay clean.
    const mask = document.createElement('canvas')
    mask.width = width
    mask.height = height
    const mctx = mask.getContext('2d')
    if (!mctx || !entry.base) return
    mctx.drawImage(entry.base, entry.padX, entry.padY, entry.spriteW, entry.spriteH)
    mctx.globalCompositeOperation = 'destination-in'
    const fx = entry.padX + entry.anchor.face.x * entry.spriteW
    const fy = entry.padY + entry.anchor.face.y * entry.spriteH
    const r = entry.anchor.headW * entry.spriteW * 0.6
    const grad = mctx.createRadialGradient(fx, fy, r * 0.42, fx, fy, r)
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    mctx.fillStyle = grad
    mctx.fillRect(0, 0, width, height)
    ctx.drawImage(mask, 0, 0)
  }

  private applyHat(ctx: CanvasRenderingContext2D, entry: Entry, id: string): void {
    const hat = hatById(id)
    if (!hat) return
    const anchor = entry.anchor
    const headW = anchor.headW * entry.spriteW
    const mount = hat.mount === 'face' ? anchor.face : anchor.head
    ctx.save()
    ctx.translate(entry.padX + mount.x * entry.spriteW, entry.padY + mount.y * entry.spriteH)
    const tilt = hat.mount === 'face' ? anchor.faceRot : anchor.rot
    ctx.rotate(((tilt + hat.rot) * Math.PI) / 180)
    ctx.translate(hat.dx * headW, hat.dy * headW)
    const w = headW * hat.scale
    if (hat.source === 'draw') {
      DRAWN_HATS[hat.id]?.(ctx, w)
    } else {
      const img = this.hatImage(hat.id)
      if (img) {
        const h = (w * img.naturalHeight) / img.naturalWidth
        ctx.drawImage(img, -w / 2, hat.mount === 'face' ? -h / 2 : -h * 0.82, w, h)
      }
    }
    ctx.restore()
  }
}

/** Cuts the transparent margin off, so an `<img>` shows the kitten at full size. */
function trim(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext('2d')
  if (!ctx) return source
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return source
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  out.getContext('2d')?.drawImage(source, -minX, -minY)
  return out
}
