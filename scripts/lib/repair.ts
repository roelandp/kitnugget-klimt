import sharp from 'sharp'
import { clone, luma, toSharp, type Img } from './image'

/**
 * Known glitches in the delivered backgrounds, see ASSETS.md.
 *
 * Two of the Gemini renders came back with a small blurry copy of another room
 * faded over the bottom left and bottom right corners, and the space render came
 * back with a lighter vertical rectangle down the middle. Both fades are soft, so
 * there is nothing reliable to detect: the geometry below was measured by hand on
 * the delivered files and is expressed in fractions so it survives a rescale.
 *
 * Replace a background with a corrected render and delete its entry here.
 */
export interface InsetRepair {
  /** Where the pasted corners start, as a fraction of the height. */
  seam: number
  /** The clean middle columns to rebuild the corners from, as fractions of the width. */
  cx0: number
  cx1: number
}

export const INSET_REPAIRS: Record<string, InsetRepair> = {
  'bg-woonkamer': { seam: 1040 / 1376, cx0: 246 / 768, cx1: 519 / 768 },
  'bg-zolder': { seam: 1040 / 1376, cx0: 246 / 768, cx1: 519 / 768 },
}

export const BAND_REPAIRS = new Set(['bg-ruimte'])

/**
 * Rebuilds the pasted corners from the clean middle columns: the strip is
 * mirrored and stretched outward so the floor keeps running to both edges, then
 * feathered in vertically and softened to match the depth of field.
 */
export async function repairInsets(img: Img, spec: InsetRepair): Promise<Img> {
  const { width, height } = img
  const cx0 = Math.round(spec.cx0 * width)
  const cx1 = Math.round(spec.cx1 * width)
  const seam = Math.round(spec.seam * height)
  const span = cx1 - cx0
  if (span < 8 || seam >= height - 4) return img

  const source = (x: number): number => {
    if (x >= cx0 && x <= cx1) return x
    // Mirror the clean strip outward, stretched to reach the frame edge.
    const t = x < cx0 ? x / Math.max(1, cx0) : (x - cx1) / Math.max(1, width - 1 - cx1)
    return Math.round(cx1 - t * span)
  }

  const feather = 48
  const top = Math.max(0, seam - feather)
  const out = clone(img)
  for (let y = top; y < height; y++) {
    const mix = Math.min(1, (y - top) / feather)
    for (let x = 0; x < width; x++) {
      if (x >= cx0 && x <= cx1) continue
      const src = (y * width + source(x)) * 4
      const dst = (y * width + x) * 4
      for (let c = 0; c < 3; c++) out.data[dst + c] = out.data[dst + c] * (1 - mix) + img.data[src + c] * mix
    }
  }

  // A soft blur over the rebuilt corners hides the mirror axis and matches the DOF.
  const bandHeight = height - top
  const { data: soft, info } = await toSharp(out)
    .extract({ left: 0, top, width, height: bandHeight })
    .blur(4)
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let y = 0; y < bandHeight; y++) {
    const gy = top + y
    const fade = Math.min(1, (gy - top) / feather)
    for (let x = 0; x < width; x++) {
      if (x >= cx0 && x <= cx1) continue
      // Keep a little sharpness right next to the clean strip.
      const near = Math.min(Math.abs(x - cx0), Math.abs(x - cx1)) / 60
      const k = fade * Math.min(1, near)
      const dst = (gy * width + x) * 4
      const src = (y * width + x) * info.channels
      for (let c = 0; c < 3; c++) out.data[dst + c] = out.data[dst + c] * (1 - k) + soft[src + c] * k
    }
  }
  return out
}

/**
 * Removes a lighter vertical rectangle from a background.
 *
 * The artifact is separable: a fixed profile across x, scaled by an amplitude
 * that drifts slowly down the frame. Estimating those two factors separately
 * keeps the rectangle's sharp vertical edges intact in the correction, which a
 * blur-based field cannot do, and leaves every star exactly as bright as before.
 */
export async function repairVerticalBand(img: Img): Promise<{ img: Img; repaired: boolean }> {
  const { width, height } = img

  // Column profile of the raw image: averaging over rows already removes the stars.
  const y0 = Math.floor(height * 0.08)
  const y1 = Math.floor(height * 0.92)
  const profile = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = y0; y < y1; y++) sum += luma(img.data, (y * width + x) * 4)
    profile[x] = sum / (y1 - y0)
  }
  const smooth = boxBlur1d(profile, 4)

  const from = Math.floor(width * 0.08)
  const to = Math.floor(width * 0.92)
  let rise = { x: -1, v: 0 }
  let fall = { x: -1, v: 0 }
  for (let x = from; x < to; x++) {
    const g = smooth[x] - smooth[x - 1]
    if (g > rise.v) rise = { x, v: g }
    if (g < -fall.v) fall = { x, v: -g }
  }
  if (rise.x < 0 || fall.x < 0 || fall.x - rise.x < width * 0.12 || Math.min(rise.v, fall.v) < 0.8) {
    return { img, repaired: false }
  }

  const pad = Math.round(width * 0.03)
  const xL = Math.max(0, rise.x - pad)
  const xR = Math.min(width - 1, fall.x + pad)

  // Shape across x: how much brighter each column is than a straight line drawn
  // between the columns just outside the rectangle.
  const shape = new Float64Array(width)
  let peak = 0
  for (let x = xL; x <= xR; x++) {
    const t = (x - xL) / Math.max(1, xR - xL)
    const base = smooth[xL] * (1 - t) + smooth[xR] * t
    const v = Math.max(0, smooth[x] - base)
    shape[x] = v
    if (v > peak) peak = v
  }
  if (peak < 1) return { img, repaired: false }
  for (let x = xL; x <= xR; x++) shape[x] /= peak

  // Amplitude down y, per channel, measured inside the rectangle against both sides.
  const inner0 = Math.min(width - 1, rise.x + pad)
  const inner1 = Math.max(0, fall.x - pad)
  const side = Math.max(8, Math.round(width * 0.06))
  const amp: Float64Array[] = [new Float64Array(height), new Float64Array(height), new Float64Array(height)]
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 3; c++) {
      const inside = meanChannel(img, y, inner0, inner1, c)
      const left = meanChannel(img, y, Math.max(0, xL - side), xL, c)
      const right = meanChannel(img, y, xR, Math.min(width - 1, xR + side), c)
      amp[c][y] = inside - (left + right) / 2
    }
  }
  // The rectangle's brightness drifts slowly, stars do not: smooth hard down y.
  const ampSmooth = amp.map((a) => boxBlur1d(a, Math.max(16, Math.round(height / 24))))

  const out = clone(img)
  for (let y = 0; y < height; y++) {
    for (let x = xL; x <= xR; x++) {
      const k = shape[x]
      if (k <= 0) continue
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) out.data[i + c] = out.data[i + c] - ampSmooth[c][y] * k
    }
  }
  return { img: out, repaired: true }
}

function meanChannel(img: Img, y: number, x0: number, x1: number, c: number): number {
  let sum = 0
  let n = 0
  for (let x = x0; x <= x1; x++) {
    sum += img.data[(y * img.width + x) * 4 + c]
    n++
  }
  return n ? sum / n : 0
}

function boxBlur1d(values: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(values.length)
  for (let i = 0; i < values.length; i++) {
    let sum = 0
    let n = 0
    for (let k = -radius; k <= radius; k++) {
      const j = i + k
      if (j < 0 || j >= values.length) continue
      sum += values[j]
      n++
    }
    out[i] = sum / n
  }
  return out
}

/** Mirror-tiles a texture when its edges do not meet, so it tiles seamlessly. */
export async function makeTileable(file: string, size: number): Promise<Buffer> {
  const half = Math.round(size / 2)
  const quarter = await sharp(file).resize(half, half, { fit: 'fill' }).toBuffer()
  const flipH = await sharp(quarter).flop().toBuffer()
  const flipV = await sharp(quarter).flip().toBuffer()
  const flipBoth = await sharp(quarter).flip().flop().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 3, background: '#000' } })
    .composite([
      { input: quarter, left: 0, top: 0 },
      { input: flipH, left: half, top: 0 },
      { input: flipV, left: 0, top: half },
      { input: flipBoth, left: half, top: half },
    ])
    .png()
    .toBuffer()
}
