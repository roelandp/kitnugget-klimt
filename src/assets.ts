export interface SpriteInfo {
  file: string
  w: number
  h: number
}

export interface Manifest {
  generated: string
  pole: { left: number; right: number } | null
  sprites: Record<string, SpriteInfo>
  items: Record<string, string>
  backgrounds: Record<string, string>
  title: string | null
  textures: Record<string, string>
  audio: Record<string, string>
  meows: string[]
  music: string[]
  missing: string[]
}

const EMPTY: Manifest = {
  generated: '',
  pole: null,
  sprites: {},
  items: {},
  backgrounds: {},
  title: null,
  textures: {},
  audio: {},
  meows: [],
  music: [],
  missing: [],
}

/** Pole band to use when the sprites never arrived. Matches the delivered art. */
export const FALLBACK_POLE = { left: 0.2134, right: 0.3821 }

export class Assets {
  readonly manifest: Manifest
  private base: string

  private constructor(manifest: Manifest, base: string) {
    this.manifest = manifest
    this.base = base
  }

  static async load(): Promise<Assets> {
    const base = new URL('./', location.href).href
    try {
      const res = await fetch(`${base}sprites/sprites.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(String(res.status))
      return new Assets({ ...EMPTY, ...(await res.json()) }, base)
    } catch {
      // No pipeline output: everything falls back to code-drawn art.
      return new Assets(EMPTY, base)
    }
  }

  url(path: string): string {
    return `${this.base}${path}`
  }

  sprite(name: string): SpriteInfo | null {
    return this.manifest.sprites[name] ?? null
  }

  spriteUrl(name: string): string | null {
    const s = this.sprite(name)
    return s ? this.url(s.file) : null
  }

  /** Falls back to `happy` for the optional wake pose. */
  poseUrl(name: string): string | null {
    if (name === 'wake' && !this.sprite('wake')) return this.spriteUrl('happy') ?? this.spriteUrl('beg')
    return this.spriteUrl(name)
  }

  itemUrl(id: string): string | null {
    const p = this.manifest.items[id]
    return p ? this.url(p) : null
  }

  backgroundUrl(zoneId: string): string | null {
    const p = this.manifest.backgrounds[zoneId]
    return p ? this.url(p) : null
  }

  titleUrl(): string | null {
    return this.manifest.title ? this.url(this.manifest.title) : null
  }

  textureUrl(name: string): string | null {
    const p = this.manifest.textures[name]
    return p ? this.url(p) : null
  }

  audioUrl(name: string): string | null {
    const p = this.manifest.audio[name]
    return p ? this.url(p) : null
  }

  get pole(): { left: number; right: number } {
    return this.manifest.pole ?? FALLBACK_POLE
  }
}
