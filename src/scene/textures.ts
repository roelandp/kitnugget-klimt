import * as THREE from 'three'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Sisal rope, used when the texture from the pipeline is missing. */
export function proceduralRope(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#d9bd8e'
  ctx.fillRect(0, 0, 128, 128)
  const rows = 8
  for (let i = 0; i < rows; i++) {
    const y = (i * 128) / rows
    const g = ctx.createLinearGradient(0, y, 0, y + 128 / rows)
    g.addColorStop(0, '#f0dcb4')
    g.addColorStop(0.45, '#d7b988')
    g.addColorStop(1, '#a98a5d')
    ctx.fillStyle = g
    ctx.fillRect(0, y, 128, 128 / rows + 1)
    ctx.strokeStyle = 'rgba(120, 90, 55, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = -16; x < 144; x += 16) {
      ctx.moveTo(x, y + 128 / rows)
      ctx.lineTo(x + 10, y)
    }
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Plush carpet for the platforms. */
export function proceduralCarpet(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#e4cfa9'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 128
    const y = Math.random() * 128
    const shade = 190 + Math.random() * 60
    ctx.fillStyle = `rgba(${shade}, ${shade - 22}, ${shade - 60}, 0.5)`
    ctx.fillRect(x, y, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * Stand-in for a missing Kit Nugget sprite: a chunky orange kitten built from
 * primitives, with the same pole gap so the alignment maths stays identical.
 */
export function placeholderCatCanvas(pose: string, poleLeft: number, poleRight: number): HTMLCanvasElement {
  const W = 515
  const H = 768
  const [c, ctx] = canvas(W, H)
  const bodyX = poleRight * W
  const bodyW = W - bodyX - 20
  const orange = '#f0a濃'.slice(0, 7)
  ctx.fillStyle = '#efa45f'

  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  }

  // Tail, curling out to the right at the bottom.
  ctx.strokeStyle = '#efa45f'
  ctx.lineWidth = 34
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bodyX + bodyW * 0.5, H * 0.78)
  ctx.quadraticCurveTo(W - 10, H * 0.9, bodyX + bodyW * 0.2, H * 0.96)
  ctx.stroke()

  // Ears.
  ctx.fillStyle = '#e8944c'
  for (const dx of [0.22, 0.78]) {
    ctx.beginPath()
    ctx.moveTo(bodyX + bodyW * dx - 34, H * 0.13)
    ctx.lineTo(bodyX + bodyW * dx, H * 0.03)
    ctx.lineTo(bodyX + bodyW * dx + 34, H * 0.13)
    ctx.closePath()
    ctx.fill()
  }

  // Head and body.
  ctx.fillStyle = '#f2ab68'
  round(bodyX, H * 0.06, bodyW, H * 0.3, bodyW * 0.42)
  round(bodyX + bodyW * 0.08, H * 0.32, bodyW * 0.84, H * 0.46, bodyW * 0.34)

  // Far paws, left of the pole gap, cut at the gap edge.
  ctx.fillStyle = '#f7bd84'
  round(poleLeft * W - 58, H * 0.33, 58, 98, 26)
  round(poleLeft * W - 58, H * 0.62, 58, 98, 26)
  // Near paws, gripping in front of the pole.
  round(bodyX - 52, H * 0.35, 92, 86, 28)
  round(bodyX - 34, H * 0.63, 92, 86, 28)

  // Face.
  const eyeY = H * 0.17
  const eyeDx = bodyW * 0.2
  const cx = bodyX + bodyW * 0.5
  ctx.fillStyle = '#4a2a18'
  const closed = pose === 'happy' || pose === 'sleep'
  for (const s of [-1, 1]) {
    if (closed) {
      ctx.lineWidth = 9
      ctx.strokeStyle = '#4a2a18'
      ctx.beginPath()
      ctx.arc(cx + s * eyeDx, eyeY, 20, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(cx + s * eyeDx, eyeY, pose === 'surprised' ? 26 : 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(cx + s * eyeDx + 7, eyeY - 8, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4a2a18'
    }
  }
  ctx.fillStyle = '#e88f9a'
  ctx.beginPath()
  ctx.ellipse(cx, eyeY + 42, 15, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#4a2a18'
  ctx.lineWidth = 7
  ctx.beginPath()
  if (pose === 'surprised') {
    ctx.arc(cx, eyeY + 74, 16, 0, Math.PI * 2)
  } else {
    ctx.arc(cx - 15, eyeY + 60, 16, 0, Math.PI * 0.9)
    ctx.arc(cx + 15, eyeY + 60, 16, Math.PI * 0.1, Math.PI)
  }
  ctx.stroke()

  void orange
  return c
}

/** Simple grey mouse for when the sprite is missing. */
export function placeholderMouse(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 80)
  ctx.fillStyle = '#b9bcc4'
  ctx.beginPath()
  ctx.ellipse(62, 46, 40, 26, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(98, 40, 20, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e7a9b4'
  ctx.beginPath()
  ctx.arc(88, 24, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#4a4a52'
  ctx.beginPath()
  ctx.arc(106, 38, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#b9bcc4'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(24, 50)
  ctx.quadraticCurveTo(4, 36, 14, 14)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Low-poly stand-in for a collectible. */
export function placeholderItem(color: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(64, 14)
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.beginPath()
  ctx.ellipse(50, 46, 18, 12, -0.5, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Repeating star field for the space zone, drawn as a tiling CSS background. */
export function starTileDataUrl(size = 220): string {
  const [c, ctx] = canvas(size, size)
  ctx.clearRect(0, 0, size, size)
  const count = 26
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 0.6 + Math.random() * 1.9
    const a = 0.35 + Math.random() * 0.55
    ctx.fillStyle = `rgba(255, 250, 235, ${a})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c.toDataURL('image/png')
}
