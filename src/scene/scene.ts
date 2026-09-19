import * as THREE from 'three'
import type { Assets } from '../assets'
import { ITEMS } from '../content/items'
import type { SceneEvent } from '../game/events'
import { placeholderCat, placeholderItem, placeholderMouse, proceduralCarpet, proceduralRope } from './textures'

export type Pose = 'hang' | 'surprised' | 'happy' | 'jump'

/** One metre of climbing is one world unit. */
const CAT_HEIGHT = 6
const VIEW_HEIGHT = 15
const FOV = 42
// Every item height is a multiple of ten, so this spacing puts each one on a platform.
const PLATFORM_SPACING = 5
const PLATFORM_RADIUS = 2.4
const PLATFORM_OFFSET = 1.35
const POLE_SEGMENT = 30
/** How far above Kit Nugget the camera sits, so the next platform stays in frame. */
const CAMERA_LIFT = 2.2

const POSE_ORDER: Pose[] = ['hang', 'surprised', 'happy', 'jump']

interface Platform {
  group: THREE.Group
  item: THREE.Mesh | null
  height: number
}

interface Spark {
  mesh: THREE.Mesh
  vx: number
  vy: number
  life: number
}

/**
 * The 2.5D scene: an endless rope post, recycled carpet platforms and Kit Nugget
 * as a sprite anchored so the gap in the art sits exactly on the post.
 *
 * Knows nothing about sums. It only receives the events in game/events.ts.
 */
export class Scene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private assets: Assets

  private pole!: THREE.Mesh
  private poleTexture!: THREE.Texture
  private poleRadius = 0.3
  private platforms: Platform[] = []
  private carpet!: THREE.Texture
  private decorations: string[] = []

  private cat!: THREE.Mesh
  private catMaterial!: THREE.MeshBasicMaterial
  private poses = new Map<Pose, THREE.Texture>()
  private poseSize = new Map<Pose, { w: number; h: number; offsetX: number }>()
  private pose: Pose = 'hang'
  private catPlaneWidth = 3
  private catAnchorX = 0
  private facing = 1

  private mouse!: THREE.Mesh
  private mouseMaterial!: THREE.MeshBasicMaterial
  private mouseActive = false
  private mouseT = 0
  private mouseDuration = 6
  private mouseEscape = 0
  private mouseStyle: 'muis' | 'ring' = 'muis'

  private sparks: Spark[] = []
  private sparkGeometry = new THREE.PlaneGeometry(0.34, 0.34)
  private sparkMaterial!: THREE.MeshBasicMaterial

  private height = 0
  private displayHeight = 0
  private cameraY = 0
  private collected = new Set<string>()

  private jump: { from: number; to: number; t: number; dur: number; kind: 'big' | 'small' } | null = null
  private wobble = 0
  private clock = new THREE.Clock()
  private running = false
  private frame = 0
  private pendingParallax = 0

  /** Reported every frame so the backdrop can follow the climb. */
  onHeight: ((metres: number, parallax: number) => void) | null = null

  constructor(canvas: HTMLCanvasElement, assets: Assets) {
    this.assets = assets
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearAlpha(0)
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200)
    this.camera.position.z = VIEW_HEIGHT / (2 * Math.tan((FOV * Math.PI) / 360))

    this.buildLights()
    this.buildCat()
    this.buildPole()
    this.buildPlatforms()
    this.buildMouse()
    this.buildSparks()
    this.resize()
  }

  // ---------- building ----------

  private buildLights(): void {
    // A warm bounce from below, otherwise the undersides of the platforms go black.
    const hemi = new THREE.HemisphereLight(0xfff0da, 0xc0a084, 2.1)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffd9a8, 1.5)
    key.position.set(3, 6, 8)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.5)
    rim.position.set(-5, 2, -4)
    this.scene.add(rim)
  }

  private texture(url: string | null, fallback: () => THREE.Texture): THREE.Texture {
    if (!url) return fallback()
    const tex = new THREE.TextureLoader().load(url, () => {
      this.frame = 0
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    return tex
  }

  private buildCat(): void {
    const pole = this.assets.pole
    const info = this.assets.sprite('hang')
    const aspect = info ? info.w / info.h : 515 / 768
    this.catPlaneWidth = CAT_HEIGHT * aspect
    const band = Math.max(0.02, pole.right - pole.left)
    this.poleRadius = (this.catPlaneWidth * band) / 2
    // Put the middle of the gap exactly on the post axis.
    this.catAnchorX = -((pole.left + pole.right) / 2 - 0.5) * this.catPlaneWidth

    for (const pose of POSE_ORDER) {
      const url = this.assets.spriteUrl(pose)
      this.poses.set(pose, this.texture(url, () => placeholderCat(pose, pole.left, pole.right)))
      const size = this.assets.sprite(pose)
      const poseAspect = size ? size.w / size.h : aspect
      // The three post poses share one canvas and one anchor; jump is a free
      // pose with its own shape, so it keeps its own width and hops a little
      // clear of the post.
      const onPole = pose !== 'jump'
      this.poseSize.set(pose, {
        w: onPole ? this.catPlaneWidth : CAT_HEIGHT * poseAspect,
        h: CAT_HEIGHT,
        offsetX: onPole ? this.catAnchorX : this.catAnchorX * 0.45,
      })
    }

    this.catMaterial = new THREE.MeshBasicMaterial({
      map: this.poses.get('hang')!,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      alphaTest: 0.02,
    })
    this.cat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.catMaterial)
    this.cat.renderOrder = 10
    this.cat.position.set(this.catAnchorX, 0, this.poleRadius + 0.12)
    this.scene.add(this.cat)
  }

  private buildPole(): void {
    this.poleTexture = this.texture(this.assets.textureUrl('rope'), proceduralRope)
    this.poleTexture.wrapS = this.poleTexture.wrapT = THREE.RepeatWrapping
    this.poleTexture.repeat.set(2, POLE_SEGMENT / (this.poleRadius * 4))
    this.poleTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const geo = new THREE.CylinderGeometry(this.poleRadius, this.poleRadius, POLE_SEGMENT, 20, 1, true)
    const mat = new THREE.MeshLambertMaterial({ map: this.poleTexture })
    this.pole = new THREE.Mesh(geo, mat)
    this.scene.add(this.pole)
  }

  private buildPlatforms(): void {
    this.carpet = this.texture(this.assets.textureUrl('carpet'), proceduralCarpet)
    this.carpet.wrapS = this.carpet.wrapT = THREE.RepeatWrapping
    this.carpet.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.carpet.repeat.set(1.2, 1.2)
    const top = new THREE.MeshLambertMaterial({ map: this.carpet })
    const side = new THREE.MeshLambertMaterial({ color: 0xd8bd94 })
    const geo = new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS * 0.93, 0.5, 26)
    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group()
      const disc = new THREE.Mesh(geo, [side, top, top])
      group.add(disc)
      group.visible = false
      this.scene.add(group)
      this.platforms.push({ group, item: null, height: -1 })
    }
  }

  private buildMouse(): void {
    this.mouseMaterial = new THREE.MeshBasicMaterial({
      map: this.texture(this.assets.spriteUrl('mouse'), placeholderMouse),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    const info = this.assets.sprite('mouse')
    const aspect = info ? info.w / info.h : 511 / 256
    const h = 1.05
    this.mouse = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), this.mouseMaterial)
    this.mouse.renderOrder = 9
    this.mouse.visible = false
    this.scene.add(this.mouse)
  }

  private buildSparks(): void {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff3cf'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 30 : 12
      ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.sparkMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })
  }

  // ---------- public API ----------

  setMouseStyle(style: 'muis' | 'ring'): void {
    this.mouseStyle = style
    if (style === 'ring') this.mouse.visible = false
  }

  setCollected(ids: Iterable<string>): void {
    this.collected = new Set(ids)
    for (const p of this.platforms) p.height = -1
  }

  setDecorations(ids: string[]): void {
    this.decorations = ids.filter(Boolean)
    for (const p of this.platforms) p.height = -1
  }

  /** Places Kit Nugget without animating, e.g. when a round starts. */
  setHeight(metres: number): void {
    this.height = metres
    this.displayHeight = metres
    this.cameraY = metres + CAMERA_LIFT
    this.jump = null
    this.updateFacing()
  }

  event(e: SceneEvent): void {
    switch (e.type) {
      case 'bigJump':
        this.startJump(this.height + e.metres, 'big')
        break
      case 'smallStep':
        this.startJump(this.height + e.metres, 'small')
        break
      case 'stay':
        this.setPose('surprised')
        this.wobble = 1
        break
      case 'combo':
        this.burst(Math.min(4 + e.n, 12))
        break
      case 'itemCollected':
        this.collected.add(e.id)
        this.burst(10)
        for (const p of this.platforms) if (p.item) p.height = -1
        break
      case 'roundStart':
        this.setPose('hang')
        break
      case 'roundEnd':
        this.setPose('happy')
        break
      case 'zoneChanged':
        break
    }
  }

  setPose(pose: Pose): void {
    const tex = this.poses.get(pose)
    if (!tex) return
    this.pose = pose
    if (this.catMaterial.map !== tex) {
      this.catMaterial.map = tex
      this.catMaterial.needsUpdate = true
    }
  }

  /** Starts the mouse walking the platform above Kit Nugget. */
  startTimer(seconds: number): void {
    this.mouseDuration = Math.max(1, seconds)
    this.mouseT = 0
    this.mouseEscape = 0
    this.mouseActive = true
    if (this.mouseStyle === 'muis') this.mouse.visible = true
  }

  stopTimer(caught: boolean): void {
    if (!this.mouseActive) return
    this.mouseActive = false
    if (caught) {
      this.burst(8, this.mouse.position.x, this.mouse.position.y)
      this.mouse.visible = false
    } else {
      this.mouseEscape = 1
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.clock.start()
    const loop = () => {
      if (!this.running) return
      this.frame = requestAnimationFrame(loop)
      this.tick(Math.min(this.clock.getDelta(), 0.05))
    }
    this.frame = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frame)
  }

  resize(): void {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Keep the same vertical field of view on every screen shape.
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.stop()
    this.renderer.dispose()
  }

  // ---------- animation ----------

  private startJump(to: number, kind: 'big' | 'small'): void {
    this.jump = { from: this.height, to, t: 0, dur: kind === 'big' ? 0.55 : 0.34, kind }
    this.height = to
    this.setPose('jump')
  }

  private updateFacing(): void {
    // Kit Nugget hangs on the side the next platform is on.
    const index = Math.round((this.displayHeight + 2) / PLATFORM_SPACING)
    this.facing = index % 2 === 0 ? 1 : -1
  }

  private burst(count: number, x?: number, y?: number): void {
    const ox = x ?? this.cat.position.x + this.facing * this.catPlaneWidth * 0.18
    const oy = y ?? this.displayHeight + CAT_HEIGHT * 0.22
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeometry, this.sparkMaterial.clone())
      mesh.position.set(ox + (Math.random() - 0.5) * 1.2, oy + (Math.random() - 0.5) * 1.2, this.poleRadius + 0.4)
      mesh.renderOrder = 12
      this.scene.add(mesh)
      this.sparks.push({
        mesh,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 1.4 + Math.random() * 3,
        life: 0.55 + Math.random() * 0.35,
      })
    }
  }

  private tick(dt: number): void {
    const time = this.clock.elapsedTime

    // Kit Nugget's height, with an arc during a jump.
    let arc = 0
    let squash = 1
    if (this.jump) {
      this.jump.t += dt
      const p = Math.min(1, this.jump.t / this.jump.dur)
      const eased = p * p * (3 - 2 * p)
      this.displayHeight = this.jump.from + (this.jump.to - this.jump.from) * eased
      arc = Math.sin(p * Math.PI) * (this.jump.kind === 'big' ? 0.55 : 0.25)
      squash = 1 + Math.sin(p * Math.PI) * (this.jump.kind === 'big' ? 0.11 : 0.05)
      if (p >= 1) {
        this.jump = null
        this.displayHeight = this.height
        this.setPose('hang')
        this.updateFacing()
      }
    } else {
      this.displayHeight += (this.height - this.displayHeight) * Math.min(1, dt * 8)
    }

    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 2)
    }

    // Camera follows with a little lag.
    const target = this.displayHeight + CAMERA_LIFT
    this.cameraY += (target - this.cameraY) * Math.min(1, dt * 3.4)
    this.camera.position.y = this.cameraY
    this.camera.lookAt(0, this.cameraY, 0)

    // Post: one cylinder parked on the camera, scrolling its texture instead.
    this.pole.position.y = this.cameraY
    this.poleTexture.offset.y = -this.cameraY / (this.poleRadius * 4)

    this.layoutPlatforms()

    // Kit Nugget.
    const size = this.poseSize.get(this.pose) ?? { w: this.catPlaneWidth, h: CAT_HEIGHT, offsetX: this.catAnchorX }
    const idle = Math.sin(time * 1.9) * 0.05 + (this.wobble > 0 ? Math.sin(time * 26) * 0.09 * this.wobble : 0)
    this.cat.position.y = this.displayHeight + arc + idle
    this.cat.position.x = this.facing * size.offsetX + this.facing * 0.02 * Math.sin(time * 1.5)
    this.cat.scale.set(this.facing * size.w * (2 - squash), size.h * squash, 1)

    this.tickMouse(dt)
    this.tickSparks(dt)

    this.renderer.render(this.scene, this.camera)
    this.onHeight?.(this.displayHeight, arc + this.pendingParallax)
    this.pendingParallax = arc
  }

  private layoutPlatforms(): void {
    const first = Math.floor((this.cameraY - VIEW_HEIGHT) / PLATFORM_SPACING)
    const wanted: { height: number; item: string | null }[] = []
    for (let i = 0; i < this.platforms.length; i++) {
      const height = (first + i) * PLATFORM_SPACING
      if (height < 0) {
        wanted.push({ height: -1, item: null })
        continue
      }
      // An item sits on the platform nearest its unlock height.
      const item = ITEMS.find((it) => Math.abs(it.height - height) <= PLATFORM_SPACING / 2) ?? null
      wanted.push({ height, item: item ? item.id : null })
    }
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i]
      const w = wanted[i]
      if (w.height < 0) {
        p.group.visible = false
        continue
      }
      p.group.visible = true
      const side = Math.round(w.height / PLATFORM_SPACING) % 2 === 0 ? 1 : -1
      p.group.position.set(side * PLATFORM_OFFSET, w.height, 0)
      if (p.height === w.height) continue
      p.height = w.height
      if (p.item) {
        p.group.remove(p.item)
        p.item = null
      }
      if (w.item && !this.collected.has(w.item)) {
        p.item = this.makeItem(w.item, side)
        p.group.add(p.item)
      } else if (this.decorations.length > 0) {
        const platformIdx = Math.round(w.height / PLATFORM_SPACING)
        // Show decoration on every other platform that does not have an uncollected milestone item
        if (platformIdx > 0 && platformIdx % 2 === 0) {
          const decId = this.decorations[Math.floor(platformIdx / 2) % this.decorations.length]
          if (decId) {
            p.item = this.makeItem(decId, side)
            p.group.add(p.item)
          }
        }
      }
    }
  }

  private makeItem(id: string, side: number): THREE.Mesh {
    const def = ITEMS.find((it) => it.id === id)!
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture(this.assets.itemUrl(id), () => placeholderItem(def.color)),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), mat)
    mesh.position.set(side * 0.7, 0.9, 1.4)
    mesh.renderOrder = 8
    return mesh
  }

  private tickMouse(dt: number): void {
    if (this.mouseStyle !== 'muis') return
    if (this.mouseEscape > 0) {
      this.mouseEscape = Math.max(0, this.mouseEscape - dt * 1.6)
      this.mouse.position.x += dt * 7 * Math.sign(this.mouse.scale.x || 1)
      this.mouseMaterial.opacity = this.mouseEscape
      this.mouseMaterial.transparent = true
      if (this.mouseEscape === 0) this.mouse.visible = false
      return
    }
    if (!this.mouseActive) return
    this.mouseT = Math.min(1, this.mouseT + dt / this.mouseDuration)
    // The platform above Kit Nugget, walked from the outer rim to the post.
    const above = (Math.floor(this.displayHeight / PLATFORM_SPACING) + 1) * PLATFORM_SPACING
    const side = Math.round(above / PLATFORM_SPACING) % 2 === 0 ? 1 : -1
    const fromX = side * (PLATFORM_OFFSET + PLATFORM_RADIUS * 0.8)
    const toX = side * PLATFORM_OFFSET * 0.1
    this.mouse.position.set(fromX + (toX - fromX) * this.mouseT, above + 0.58, 1.4)
    this.mouse.scale.x = -side
    this.mouseMaterial.opacity = 1
    if (this.mouseT >= 1) {
      this.mouseActive = false
      this.mouseEscape = 1
    }
  }

  private tickSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      s.vy -= dt * 5
      s.mesh.position.x += s.vx * dt
      s.mesh.position.y += s.vy * dt
      s.mesh.rotation.z += dt * 4
      const mat = s.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, s.life * 2)
      if (s.life <= 0) {
        this.scene.remove(s.mesh)
        mat.dispose()
        this.sparks.splice(i, 1)
      }
    }
  }
}
