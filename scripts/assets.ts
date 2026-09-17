/**
 * Asset pipeline. Reads whatever is in assets-raw/inbox, keys the green screen,
 * measures the scratching post cut-out on the three hanging poses, cuts the item
 * sheet apart, repairs the two known background glitches and writes everything
 * to public/ plus a manifest the game reads at runtime.
 *
 * Every asset is optional. Anything missing is reported and the game falls back.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import {
  bleedEdges,
  components,
  cropTo,
  featherAlpha,
  keyGreen,
  loadRgba,
  mode,
  place,
  shiftX,
  toSharp,
  trim,
  type Img,
} from './lib/image'
import { BAND_REPAIRS, INSET_REPAIRS, makeTileable, repairInsets, repairVerticalBand } from './lib/repair'

const ROOT = new URL('..', import.meta.url).pathname
const INBOX = join(ROOT, 'assets-raw/inbox')
const PUBLIC = join(ROOT, 'public')

const POLE_POSES = ['hang', 'surprised', 'happy'] as const
const PLAIN_SPRITES = ['jump', 'sleep', 'wake', 'beg'] as const
const ZONE_BACKGROUNDS = ['woonkamer', 'zolder', 'dak', 'wolken', 'ruimte'] as const
const ITEM_ORDER = ['bell', 'bowtie', 'mouse-toy', 'yarn', 'fish', 'feather', 'crown', 'helmet'] as const

const SPRITE_MAX_H = 768
const BG_W = 1080
const BG_H = 1920
const ITEM_MAX = 256

type Manifest = {
  generated: string
  pole: { left: number; right: number } | null
  sprites: Record<string, { file: string; w: number; h: number }>
  items: Record<string, string>
  backgrounds: Record<string, string>
  title: string | null
  textures: Record<string, string>
  audio: Record<string, string>
  missing: string[]
}

const manifest: Manifest = {
  generated: new Date().toISOString(),
  pole: null,
  sprites: {},
  items: {},
  backgrounds: {},
  title: null,
  textures: {},
  audio: {},
  missing: [],
}

const notes: string[] = []
function note(line: string): void {
  notes.push(line)
  console.log(line)
}

function inbox(name: string): string | null {
  if (!existsSync(INBOX)) return null
  for (const file of readdirSync(INBOX)) {
    if (basename(file, extname(file)).toLowerCase() === name) return join(INBOX, file)
  }
  return null
}

function outDir(sub: string): string {
  const dir = join(PUBLIC, sub)
  mkdirSync(dir, { recursive: true })
  return dir
}

async function writeSpriteWebp(img: Img, sub: string, name: string): Promise<{ file: string; w: number; h: number }> {
  const scale = img.height > SPRITE_MAX_H ? SPRITE_MAX_H / img.height : 1
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const file = `${sub}/${name}.webp`
  await toSharp(img)
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toFile(join(outDir(sub), `${name}.webp`))
  return { file, w, h }
}

/** Keys, feathers and bleeds a green-screen source. */
async function cleanSprite(file: string): Promise<Img> {
  const raw = await loadRgba(file)
  const keyed = keyGreen(raw)
  const feathered = await featherAlpha(keyed)
  return bleedEdges(feathered)
}

/** The vertical strip the scratching post shows through, in pixels. */
function measurePole(img: Img, name: string): { left: number; right: number } | null {
  const comps = components(img, 110, 1500)
  if (comps.length === 0) return null
  const main = comps[0]
  const far = comps.slice(1).filter((c) => c.box.x1 < main.box.x0 + (main.box.x1 - main.box.x0) * 0.45)
  if (far.length === 0) {
    note(`  ! ${name}: geen losse pootjes gevonden, paalband niet te meten`)
    return null
  }
  const rights: number[] = []
  let yTop = img.height
  let yBottom = 0
  for (const c of far) {
    rights.push(...c.right.filter((v) => v >= 0))
    yTop = Math.min(yTop, c.box.y0)
    yBottom = Math.max(yBottom, c.box.y1)
  }
  const left = mode(rights) + 1

  // The body has a straight vertical cut across the rows where the paws sit.
  const bodyEdges: number[] = []
  for (let y = yTop; y <= yBottom; y++) {
    const idx = y - main.box.y0
    if (idx < 0 || idx >= main.left.length) continue
    const v = main.left[idx]
    if (v > left) bodyEdges.push(v)
  }
  const right = mode(bodyEdges)
  if (right <= left) {
    note(`  ! ${name}: paalband onlogisch (${left}..${right})`)
    return null
  }
  return { left, right }
}

async function doPolePoses(): Promise<void> {
  const loaded: { name: string; img: Img; band: { left: number; right: number } | null }[] = []
  for (const name of POLE_POSES) {
    const file = inbox(name)
    if (!file) {
      manifest.missing.push(name)
      continue
    }
    const img = await cleanSprite(file)
    loaded.push({ name, img, band: measurePole(img, name) })
  }
  if (loaded.length === 0) return

  // One shared canvas, the largest of the set, so the three poses swap cleanly.
  const canvasW = Math.max(...loaded.map((l) => l.img.width))
  const canvasH = Math.max(...loaded.map((l) => l.img.height))
  const measured = loaded.filter((l) => l.band)
  if (measured.length === 0) {
    for (const l of loaded) {
      const placed = place(l.img, canvasW, canvasH, 0, 0)
      manifest.sprites[l.name] = await writeSpriteWebp(placed, 'sprites', l.name)
    }
    note('  ! paalband nergens te meten, sprites zonder uitlijning weggeschreven')
    return
  }

  const centres = measured.map((l) => (l.band!.left + l.band!.right) / 2)
  const widths = measured.map((l) => l.band!.right - l.band!.left)
  const targetCentre = centres.reduce((a, b) => a + b, 0) / centres.length
  const targetWidth = widths.reduce((a, b) => a + b, 0) / widths.length

  for (const l of loaded) {
    let img = place(l.img, canvasW, canvasH, 0, 0)
    if (l.band) {
      const centre = (l.band.left + l.band.right) / 2
      const dx = targetCentre - centre
      const drift = Math.abs(dx)
      if (drift > 2) {
        img = shiftX(img, dx)
        note(`  ${l.name}: paalband ${l.band.left}..${l.band.right}, ${drift.toFixed(1)} px gecorrigeerd`)
      } else {
        note(`  ${l.name}: paalband ${l.band.left}..${l.band.right}, binnen 2 px, geen correctie`)
      }
    } else {
      note(`  ${l.name}: niet gemeten, ongecorrigeerd geplaatst`)
    }
    manifest.sprites[l.name] = await writeSpriteWebp(img, 'sprites', l.name)
  }

  manifest.pole = {
    left: (targetCentre - targetWidth / 2) / canvasW,
    right: (targetCentre + targetWidth / 2) / canvasW,
  }
  note(
    `  paalband gemiddeld ${targetWidth.toFixed(1)} px breed, ` +
      `fractie ${manifest.pole.left.toFixed(4)} .. ${manifest.pole.right.toFixed(4)}`,
  )
}

async function doPlainSprites(): Promise<void> {
  for (const name of PLAIN_SPRITES) {
    const file = inbox(name)
    if (!file) {
      manifest.missing.push(name)
      continue
    }
    const img = trim(await cleanSprite(file), 4)
    manifest.sprites[name] = await writeSpriteWebp(img, 'sprites', name)
    note(`  ${name}: ${manifest.sprites[name].w}x${manifest.sprites[name].h}`)
  }
  const mouse = inbox('mouse')
  if (mouse) {
    const img = trim(await cleanSprite(mouse), 4)
    const scale = img.height > ITEM_MAX ? ITEM_MAX / img.height : 1
    await toSharp(img)
      .resize(Math.round(img.width * scale), Math.round(img.height * scale), { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(join(outDir('misc'), 'mouse.webp'))
    manifest.sprites.mouse = { file: 'misc/mouse.webp', w: Math.round(img.width * scale), h: Math.round(img.height * scale) }
    note('  mouse: ok')
  } else {
    manifest.missing.push('mouse')
  }
}

async function doItems(): Promise<void> {
  const file = inbox('items-sheet')
  if (!file) {
    manifest.missing.push('items-sheet')
    return
  }
  const sheet = await cleanSprite(file)
  const found = components(sheet, 110, Math.round((sheet.width * sheet.height) / 600))
  if (found.length < ITEM_ORDER.length) {
    note(`  ! items-sheet: ${found.length} voorwerpen gevonden, ${ITEM_ORDER.length} verwacht`)
  }
  // Reading order: rows top to bottom, then left to right inside a row.
  const boxes = found.slice(0, ITEM_ORDER.length).map((c) => c.box)
  const heights = boxes.map((b) => b.y1 - b.y0)
  const rowTolerance = Math.max(...heights, 1) * 0.6
  boxes.sort((a, b) => {
    const ay = (a.y0 + a.y1) / 2
    const by = (b.y0 + b.y1) / 2
    if (Math.abs(ay - by) > rowTolerance) return ay - by
    return a.x0 - b.x0
  })
  const dir = outDir('items')
  for (let i = 0; i < boxes.length; i++) {
    const id = ITEM_ORDER[i]
    const b = boxes[i]
    const pad = 6
    const piece = cropTo(sheet, {
      x0: Math.max(0, b.x0 - pad),
      y0: Math.max(0, b.y0 - pad),
      x1: Math.min(sheet.width - 1, b.x1 + pad),
      y1: Math.min(sheet.height - 1, b.y1 + pad),
    })
    const scale = Math.max(piece.width, piece.height) > ITEM_MAX ? ITEM_MAX / Math.max(piece.width, piece.height) : 1
    await toSharp(piece)
      .resize(Math.round(piece.width * scale), Math.round(piece.height * scale), { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(join(dir, `${id}.webp`))
    manifest.items[id] = `items/${id}.webp`
  }
  note(`  items-sheet: ${boxes.length} voorwerpen uitgesneden`)
}

async function doBackgrounds(): Promise<void> {
  const dir = outDir('bg')
  const jobs: { name: string; key: string }[] = ZONE_BACKGROUNDS.map((z) => ({ name: `bg-${z}`, key: z }))
  jobs.push({ name: 'bg-title', key: 'title' })
  for (const job of jobs) {
    const file = inbox(job.name)
    if (!file) {
      manifest.missing.push(job.name)
      continue
    }
    let img = await loadRgba(file)
    const fixes: string[] = []
    const inset = INSET_REPAIRS[job.name]
    if (inset) {
      img = await repairInsets(img, inset)
      fixes.push('inzetjes weg')
    }
    if (BAND_REPAIRS.has(job.name)) {
      const band = await repairVerticalBand(img)
      img = band.img
      fixes.push(band.repaired ? 'lichte band weg' : 'lichte band niet gevonden, ongewijzigd')
    }
    await toSharp(img)
      .resize(BG_W, BG_H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .webp({ quality: 80, effort: 5 })
      .toFile(join(dir, `${job.key}.webp`))
    if (job.key === 'title') manifest.title = 'bg/title.webp'
    else manifest.backgrounds[job.key] = `bg/${job.key}.webp`
    note(`  ${job.name}: ok${fixes.length ? ` (${fixes.join(', ')})` : ''}`)
  }
}

async function doIcon(): Promise<void> {
  const file = inbox('icon')
  if (!file) {
    manifest.missing.push('icon')
    return
  }
  const dir = outDir('misc')
  for (const size of [192, 512]) {
    await sharp(file).resize(size, size, { fit: 'cover' }).png().toFile(join(dir, `icon-${size}.png`))
  }
  await sharp(file).resize(180, 180, { fit: 'cover' }).png().toFile(join(dir, 'apple-touch-icon.png'))
  note('  icon: 192, 512 en apple-touch-icon')
}

async function doTextures(): Promise<void> {
  const dir = outDir('misc')
  for (const name of ['rope', 'carpet'] as const) {
    const file = inbox(name)
    if (!file) {
      manifest.missing.push(name)
      continue
    }
    const tiled = await makeTileable(file, 512)
    await sharp(tiled).webp({ quality: 86 }).toFile(join(dir, `${name}.webp`))
    manifest.textures[name] = `misc/${name}.webp`
    note(`  ${name}: tileable 512`)
  }
}

function doAudio(): void {
  const dir = outDir('audio')
  for (const name of ['purr', 'meow'] as const) {
    const file = inbox(name)
    if (!file) {
      manifest.missing.push(name)
      continue
    }
    const ext = extname(file)
    writeFileSync(join(dir, `${name}${ext}`), readFileSync(file))
    manifest.audio[name] = `audio/${name}${ext}`
    note(`  ${name}: gekopieerd`)
  }
}

function reportUnknown(): void {
  if (!existsSync(INBOX)) return
  const known = new Set<string>([
    ...POLE_POSES,
    ...PLAIN_SPRITES,
    'mouse',
    'items-sheet',
    'icon',
    'rope',
    'carpet',
    'purr',
    'meow',
    ...ZONE_BACKGROUNDS.map((z) => `bg-${z}`),
    'bg-title',
  ])
  const unknown = readdirSync(INBOX)
    .filter((f) => !f.startsWith('.'))
    .filter((f) => !known.has(basename(f, extname(f)).toLowerCase()))
  if (unknown.length) {
    note(`\nOnbekend in de inbox, geef ze een van de namen hierboven: ${unknown.join(', ')}`)
  }
}

async function main(): Promise<void> {
  console.log('Kit Nugget asset-pipeline\n')
  for (const sub of ['sprites', 'bg', 'items', 'misc', 'audio']) {
    const dir = join(PUBLIC, sub)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
  console.log('Sprites aan de paal:')
  await doPolePoses()
  console.log('Losse sprites:')
  await doPlainSprites()
  console.log('Items:')
  await doItems()
  console.log('Achtergronden:')
  await doBackgrounds()
  console.log('Icoon:')
  await doIcon()
  console.log('Texturen:')
  await doTextures()
  console.log('Geluid:')
  doAudio()
  reportUnknown()

  writeFileSync(join(outDir('sprites'), 'sprites.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\nManifest: public/sprites/sprites.json`)
  if (manifest.missing.length) {
    console.log(`Ontbreekt, draait op fallback: ${manifest.missing.join(', ')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
