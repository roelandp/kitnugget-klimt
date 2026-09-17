import sharp from 'sharp'

export interface Img {
  data: Uint8ClampedArray
  width: number
  height: number
}

export async function loadRgba(file: string): Promise<Img> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
}

export function toSharp(img: Img) {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
}

export function blank(width: number, height: number): Img {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

export function clone(img: Img): Img {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }
}

/**
 * Chroma key on "greenness" (g minus the strongest of r and b), which is stable
 * even though the backdrop is not exactly #00FF00 and shifts per cell in the
 * items sheet. Anything actually green in the art would suffer, but nothing is.
 */
export function keyGreen(img: Img, low = 12, high = 48): Img {
  const out = clone(img)
  const d = out.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const other = Math.max(r, b)
    const green = g - other
    if (green <= 0) continue
    // Despill every green-dominant pixel, not just the ones that get keyed out:
    // the gold bell and crown pick up an olive cast in their shadows. Nothing in
    // the art is genuinely green-dominant, and yellow keeps r above g so it is safe.
    d[i + 1] = other + green * 0.2
    if (green <= low) continue
    const a = green >= high ? 0 : 1 - (green - low) / (high - low)
    d[i + 3] = Math.round(d[i + 3] * a)
  }
  return out
}

/** Blurs the alpha channel slightly and pulls the edge in, for a clean 1-2 px feather. */
export async function featherAlpha(img: Img, sigma = 0.9, erode = 0.12): Promise<Img> {
  const alpha = Buffer.alloc(img.width * img.height)
  for (let p = 0, i = 3; p < alpha.length; p++, i += 4) alpha[p] = img.data[i]
  // sharp may hand back more than one channel for a greyscale buffer, so stride by info.
  const { data, info } = await sharp(alpha, { raw: { width: img.width, height: img.height, channels: 1 } })
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const stride = info.channels
  const out = clone(img)
  for (let p = 0, i = 3; p < alpha.length; p++, i += 4) {
    const a = data[p * stride] / 255
    const adjusted = Math.min(1, Math.max(0, (a - erode) / (1 - erode)))
    out.data[i] = Math.round(adjusted * 255)
  }
  return out
}

/** Gaussian blur of the full RGBA image, returned as raw RGBA of the same size. */
export async function blurRgba(img: Img, sigma: number): Promise<Uint8ClampedArray> {
  const { data, info } = await toSharp(img).blur(sigma).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels === 4) return new Uint8ClampedArray(data)
  const out = new Uint8ClampedArray(img.width * img.height * 4)
  for (let p = 0; p < img.width * img.height; p++) {
    for (let c = 0; c < 3; c++) out[p * 4 + c] = data[p * info.channels + Math.min(c, info.channels - 1)]
    out[p * 4 + 3] = 255
  }
  return out
}

/**
 * Pushes colour outward into transparent pixels so webp and GPU filtering never
 * pull the key colour back in along the edge.
 */
export function bleedEdges(img: Img, passes = 3): Img {
  const out = clone(img)
  const { width, height } = out
  for (let pass = 0; pass < passes; pass++) {
    const src = new Uint8ClampedArray(out.data)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (src[i + 3] > 0) continue
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const j = (ny * width + nx) * 4
            if (src[j + 3] === 0) continue
            r += src[j]
            g += src[j + 1]
            b += src[j + 2]
            n++
          }
        }
        if (n === 0) continue
        out.data[i] = r / n
        out.data[i + 1] = g / n
        out.data[i + 2] = b / n
      }
    }
  }
  return out
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function alphaBounds(img: Img, threshold = 8): Box | null {
  let x0 = img.width
  let y0 = img.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] <= threshold) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

export function cropTo(img: Img, box: Box): Img {
  const width = box.x1 - box.x0 + 1
  const height = box.y1 - box.y0 + 1
  const out = blank(width, height)
  for (let y = 0; y < height; y++) {
    const src = ((y + box.y0) * img.width + box.x0) * 4
    out.data.set(img.data.subarray(src, src + width * 4), y * width * 4)
  }
  return out
}

/** Crops to the opaque content plus a margin, clamped to the canvas. */
export function trim(img: Img, margin = 4): Img {
  const box = alphaBounds(img)
  if (!box) return img
  return cropTo(img, {
    x0: Math.max(0, box.x0 - margin),
    y0: Math.max(0, box.y0 - margin),
    x1: Math.min(img.width - 1, box.x1 + margin),
    y1: Math.min(img.height - 1, box.y1 + margin),
  })
}

export interface Component {
  box: Box
  area: number
  /** Per-row left and right edges, indexed from box.y0. */
  left: number[]
  right: number[]
}

/** 4-connected labelling of pixels with alpha above the threshold. */
export function components(img: Img, threshold = 96, minArea = 64): Component[] {
  const { width, height } = img
  const total = width * height
  const labels = new Int32Array(total).fill(-1)
  const stack: number[] = []
  const found: Component[] = []
  for (let start = 0; start < total; start++) {
    if (labels[start] !== -1 || img.data[start * 4 + 3] <= threshold) continue
    const id = found.length
    stack.length = 0
    stack.push(start)
    labels[start] = id
    let area = 0
    let x0 = width
    let y0 = height
    let x1 = -1
    let y1 = -1
    const rowLeft = new Map<number, number>()
    const rowRight = new Map<number, number>()
    while (stack.length) {
      const p = stack.pop()!
      const x = p % width
      const y = (p / width) | 0
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      const l = rowLeft.get(y)
      if (l === undefined || x < l) rowLeft.set(y, x)
      const r = rowRight.get(y)
      if (r === undefined || x > r) rowRight.set(y, x)
      if (x > 0) push(p - 1)
      if (x < width - 1) push(p + 1)
      if (y > 0) push(p - width)
      if (y < height - 1) push(p + width)
    }
    if (area < minArea) continue
    const left: number[] = []
    const right: number[] = []
    for (let y = y0; y <= y1; y++) {
      left.push(rowLeft.get(y) ?? -1)
      right.push(rowRight.get(y) ?? -1)
    }
    found.push({ box: { x0, y0, x1, y1 }, area, left, right })

    function push(q: number): void {
      if (labels[q] !== -1 || img.data[q * 4 + 3] <= threshold) return
      labels[q] = id
      stack.push(q)
    }
  }
  return found.sort((a, b) => b.area - a.area)
}

/** The value that occurs most often, ignoring -1. Used to find a straight cut edge. */
export function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const v of values) {
    if (v < 0) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best = -1
  let bestCount = 0
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

/** Shifts the image horizontally inside the same canvas. */
export function shiftX(img: Img, dx: number): Img {
  const out = blank(img.width, img.height)
  const d = Math.round(dx)
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const sx = x - d
      if (sx < 0 || sx >= img.width) continue
      const from = (y * img.width + sx) * 4
      const to = (y * img.width + x) * 4
      out.data[to] = img.data[from]
      out.data[to + 1] = img.data[from + 1]
      out.data[to + 2] = img.data[from + 2]
      out.data[to + 3] = img.data[from + 3]
    }
  }
  return out
}

/** Places the image onto a larger canvas at (dx, dy). */
export function place(img: Img, width: number, height: number, dx = 0, dy = 0): Img {
  const out = blank(width, height)
  for (let y = 0; y < img.height; y++) {
    const ty = y + dy
    if (ty < 0 || ty >= height) continue
    for (let x = 0; x < img.width; x++) {
      const tx = x + dx
      if (tx < 0 || tx >= width) continue
      const from = (y * img.width + x) * 4
      const to = (ty * width + tx) * 4
      out.data[to] = img.data[from]
      out.data[to + 1] = img.data[from + 1]
      out.data[to + 2] = img.data[from + 2]
      out.data[to + 3] = img.data[from + 3]
    }
  }
  return out
}

export function luma(data: Uint8ClampedArray, i: number): number {
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
}
