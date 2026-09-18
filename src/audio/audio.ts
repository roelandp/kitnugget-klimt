import type { Assets } from '../assets'

type Voice = 'jump' | 'step' | 'combo' | 'wrong' | 'item' | 'roundEnd' | 'tap'

/** Music sits far under the effects: -20 dB, so it never competes with a sum. */
const EFFECT_GAIN = 0.5
const MUSIC_GAIN = EFFECT_GAIN * 0.1
const DUCK = 0.5
const CROSSFADE = 1.6

interface Loop {
  buffer: AudioBuffer
  start: number
  end: number
}

/**
 * WebAudio synth plus the real recordings when they are there. Everything is
 * short and friendly: the wrong-answer cue is a soft questioning "hm?", never a
 * buzzer. Background music loops through an AudioBufferSourceNode rather than an
 * <audio> element, because that one stutters at the loop point on iOS.
 */
export class Audio {
  private ctx: AudioContext | null = null
  private effectBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private samples = new Map<string, AudioBuffer>()
  private loops = new Map<string, Loop>()
  private loading = new Map<string, Promise<unknown>>()
  private assets: Assets

  private musicSource: AudioBufferSourceNode | null = null
  private musicGain: GainNode | null = null
  private musicTrack: string | null = null
  private lastTrack: string | null = null
  private lastMeow = -1
  private ducked = false
  private wantMusic = false

  effects = true
  music = true

  constructor(assets: Assets) {
    this.assets = assets
  }

  /** Background loops, minus the one reserved for the space zone. */
  private get normalTracks(): string[] {
    const all = this.assets.manifest.music ?? []
    return all.length > 1 ? all.slice(0, -1) : all
  }

  private get spaceTrack(): string | null {
    const all = this.assets.manifest.music ?? []
    return all.length > 1 ? all[all.length - 1] : null
  }

  /** True once the context is actually running and can make a sound. */
  get ready(): boolean {
    return this.ctx?.state === 'running'
  }

  /** Must run inside a user gesture on iOS. Safe to call repeatedly. */
  unlock(): void {
    // iOS mutes Web Audio whenever the ring/silent switch is on, unless the page
    // says what the audio is for. "playback" is the category for a game or a
    // player, and is the one thing that makes sound come out with the switch
    // flipped. Safari 16.4 and up; older browsers simply do not have it.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session && session.type !== 'playback') {
      try {
        session.type = 'playback'
      } catch {
        // Not settable here; fall through, the rest still works when unmuted.
      }
    }

    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    // A context born outside an active gesture starts suspended on iOS.
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.effectBus = this.ctx.createGain()
    this.effectBus.gain.value = EFFECT_GAIN
    this.effectBus.connect(this.ctx.destination)
    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = MUSIC_GAIN
    this.musicBus.connect(this.ctx.destination)
    void this.sampleBuffer('purr')
    for (const m of this.assets.manifest.meows ?? []) void this.sampleBuffer(m)
    if (this.wantMusic) this.playMusic()
  }

  /** Short beep plus a report, for checking sound on a device. */
  selfTest(): string {
    this.unlock()
    if (!this.ctx) return 'Geen WebAudio in deze browser'
    this.tone(660, 0, 0.18, 0.28, 'triangle')
    this.tone(880, 0.16, 0.24, 0.24, 'sine')
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    const parts = [
      `audio ${this.ctx.state}`,
      `sessie ${session ? session.type : 'niet ondersteund'}`,
      `effecten ${this.effects ? 'aan' : 'uit'}`,
      `muziek ${this.music ? 'aan' : 'uit'}${this.musicTrack ? ` (${this.musicTrack})` : ''}`,
      `opnames ${this.samples.size}`,
    ]
    return parts.join(' · ')
  }

  private async decode(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null
    try {
      const res = await fetch(url)
      return await this.ctx.decodeAudioData(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  private async sampleBuffer(name: string): Promise<AudioBuffer | null> {
    if (this.samples.has(name)) return this.samples.get(name)!
    const url = this.assets.audioUrl(name)
    if (!url || !this.ctx) return null
    const key = `s:${name}`
    if (!this.loading.has(key)) {
      this.loading.set(
        key,
        this.decode(url).then((buf) => {
          if (buf) this.samples.set(name, buf)
          return buf
        }),
      )
    }
    return (await this.loading.get(key)) as AudioBuffer | null
  }

  /**
   * MP3 carries encoder padding, so a file that loops seamlessly on disk still
   * clicks when looped sample-accurate. Trimming the silent head and tail and
   * looping between those points restores the gapless join.
   */
  private static trim(buffer: AudioBuffer): Loop {
    const data = buffer.getChannelData(0)
    const threshold = 0.0015
    let start = 0
    let end = data.length - 1
    while (start < data.length && Math.abs(data[start]) < threshold) start++
    while (end > start && Math.abs(data[end]) < threshold) end--
    // Never trim away more than a tenth of a second at either edge.
    const cap = Math.round(buffer.sampleRate * 0.1)
    start = Math.min(start, cap)
    end = Math.max(end, data.length - 1 - cap)
    return { buffer, start: start / buffer.sampleRate, end: (end + 1) / buffer.sampleRate }
  }

  private async loopBuffer(name: string): Promise<Loop | null> {
    if (this.loops.has(name)) return this.loops.get(name)!
    const url = this.assets.audioUrl(name)
    if (!url || !this.ctx) return null
    const key = `l:${name}`
    if (!this.loading.has(key)) {
      this.loading.set(
        key,
        this.decode(url).then((buf) => {
          if (!buf) return null
          const loop = Audio.trim(buf)
          this.loops.set(name, loop)
          return loop
        }),
      )
    }
    return (await this.loading.get(key)) as Loop | null
  }

  // ---------- effects ----------

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', bend = 0): void {
    if (!this.ctx || !this.effectBus) return
    const t = this.ctx.currentTime + start
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + bend), t + dur)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(env).connect(this.effectBus)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private shot(name: string, gain = 0.7): boolean {
    const buf = this.samples.get(name)
    if (!buf || !this.ctx || !this.effectBus) {
      void this.sampleBuffer(name)
      return false
    }
    const src = this.ctx.createBufferSource()
    const env = this.ctx.createGain()
    env.gain.value = gain
    src.buffer = buf
    src.connect(env).connect(this.effectBus)
    src.start()
    return true
  }

  /** Cycles through the meows so the same one never lands twice in a row. */
  private meow(gain = 0.8): boolean {
    const list = this.assets.manifest.meows ?? []
    if (list.length === 0) return false
    let i = Math.floor(Math.random() * list.length)
    if (list.length > 1 && i === this.lastMeow) i = (i + 1) % list.length
    this.lastMeow = i
    return this.shot(list[i], gain)
  }

  play(voice: Voice, n = 0): void {
    if (!this.effects) return
    this.unlock()
    if (!this.ctx) return
    switch (voice) {
      case 'jump':
        this.tone(320, 0, 0.16, 0.22, 'triangle', 340)
        this.tone(640, 0.04, 0.1, 0.1, 'sine', 180)
        break
      case 'step':
        this.tone(430, 0, 0.07, 0.16, 'triangle')
        break
      case 'combo': {
        const steps = Math.min(n, 8)
        for (let i = 0; i < 3; i++) {
          this.tone(660 * Math.pow(2, (steps + i * 3) / 12), i * 0.07, 0.16, 0.16, 'sine')
        }
        if (n >= 5) this.shot('purr', 0.35)
        break
      }
      case 'wrong':
        // A soft two-note question, rising at the end. No buzzer, no sting.
        this.tone(300, 0, 0.13, 0.13, 'sine')
        this.tone(380, 0.12, 0.2, 0.13, 'sine', 40)
        break
      case 'item':
        for (let i = 0; i < 4; i++) this.tone(900 + i * 240, i * 0.05, 0.2, 0.1, 'sine')
        break
      case 'roundEnd':
        if (!this.meow(0.8)) {
          ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.3, 0.16, 'triangle'))
        }
        break
      case 'tap':
        this.tone(520, 0, 0.04, 0.07, 'sine')
        break
    }
  }

  /** Kit Nugget waking up on the start screen. */
  wake(): void {
    if (!this.effects) return
    this.unlock()
    if (!this.meow(0.75)) {
      this.tone(440, 0, 0.22, 0.14, 'triangle', 120)
      this.tone(560, 0.18, 0.3, 0.12, 'sine', -80)
    }
  }

  // ---------- music ----------

  setEffects(on: boolean): void {
    this.effects = on
  }

  setMusic(on: boolean): void {
    this.music = on
    if (on) {
      if (this.wantMusic) this.playMusic()
    } else {
      this.fadeOutCurrent(0.4)
    }
  }

  /** Starts (or resumes) the background loop. Only has effect after a tap. */
  playMusic(zoneId?: string): void {
    this.wantMusic = true
    if (!this.music || !this.ctx) return
    const track = this.pickTrack(zoneId)
    if (!track) return
    if (track === this.musicTrack && this.musicSource) return
    void this.crossfadeTo(track)
  }

  stopMusic(): void {
    this.wantMusic = false
    this.fadeOutCurrent(0.6)
  }

  /** Called on zone changes: the space zone gets its own loop when there is one. */
  setZone(zoneId: string): void {
    if (!this.wantMusic || !this.music || !this.ctx) return
    const track = this.pickTrack(zoneId)
    if (!track || track === this.musicTrack) return
    void this.crossfadeTo(track)
  }

  private pickTrack(zoneId?: string): string | null {
    if (zoneId === 'ruimte' && this.spaceTrack) return this.spaceTrack
    const pool = this.normalTracks
    if (pool.length === 0) return null
    if (this.musicTrack && pool.includes(this.musicTrack) && zoneId !== undefined) return this.musicTrack
    let choice = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1 && choice === this.lastTrack) {
      choice = pool[(pool.indexOf(choice) + 1) % pool.length]
    }
    return choice
  }

  private async crossfadeTo(track: string): Promise<void> {
    const loop = await this.loopBuffer(track)
    if (!loop || !this.ctx || !this.musicBus || !this.music || !this.wantMusic) return
    if (track === this.musicTrack && this.musicSource) return

    this.fadeOutCurrent(CROSSFADE)

    const src = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    src.buffer = loop.buffer
    src.loop = true
    src.loopStart = loop.start
    src.loopEnd = loop.end
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    gain.gain.linearRampToValueAtTime(this.targetGain(), this.ctx.currentTime + CROSSFADE)
    src.connect(gain).connect(this.musicBus)
    src.start(0, loop.start)
    this.musicSource = src
    this.musicGain = gain
    this.musicTrack = track
    this.lastTrack = track
  }

  private fadeOutCurrent(seconds: number): void {
    const src = this.musicSource
    const gain = this.musicGain
    if (!src || !gain || !this.ctx) return
    const t = this.ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0.0001, t + seconds)
    src.stop(t + seconds + 0.05)
    this.musicSource = null
    this.musicGain = null
    this.musicTrack = null
  }

  private targetGain(): number {
    return this.ducked ? DUCK : 1
  }

  /** Halves the music while the hint overlay is up. */
  duck(on: boolean): void {
    if (this.ducked === on) return
    this.ducked = on
    if (!this.musicGain || !this.ctx) return
    const t = this.ctx.currentTime
    this.musicGain.gain.cancelScheduledValues(t)
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t)
    this.musicGain.gain.linearRampToValueAtTime(this.targetGain(), t + 0.35)
  }
}
