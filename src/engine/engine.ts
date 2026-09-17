import { makeRng, weightedPick, type Rng } from './rng'
import {
  B_MAX,
  FAST_SECONDS,
  buildFacts,
  dayKey,
  ema,
  emptyState,
  isWeak,
  limitOf,
  pushRecent,
  statusOf,
} from './facts'
import type { AnswerOutcome, Fact, FactState, Pool, Status } from './types'

/** Chance of drawing from the weak pool (nieuw / oefenen). */
export const WEAK_SHARE = 0.7
/** Edge cases b=1 and b=10 stay in the mix but are drawn far less often. */
export const EDGE_WEIGHT = 0.25

export interface QueueEntry {
  key: string
  /** Turn index at which this fact becomes due again. */
  dueTurn: number
}

export interface EngineSnapshot {
  states: Record<string, FactState>
  queue: QueueEntry[]
  turn: number
  lastKey: string | null
  lastPairKey: string | null
}

export interface Selection {
  fact: Fact
  state: FactState
  status: Status
  limit: number
  pool: Pool | 'queue'
}

export interface EngineOptions {
  tables: number[]
  seed?: number
  snapshot?: Partial<EngineSnapshot>
  /** Injectable clock, for tests. */
  now?: () => number
}

export class Engine {
  readonly facts: Fact[]
  private byKey = new Map<string, Fact>()
  private states = new Map<string, FactState>()
  private queue: QueueEntry[] = []
  private turn = 0
  private lastKey: string | null = null
  private lastPairKey: string | null = null
  private rng: Rng
  private now: () => number

  constructor(opts: EngineOptions) {
    this.facts = buildFacts(opts.tables)
    for (const f of this.facts) this.byKey.set(f.key, f)
    this.rng = makeRng(opts.seed ?? (Date.now() & 0x7fffffff))
    this.now = opts.now ?? (() => Date.now())

    const snap = opts.snapshot
    for (const f of this.facts) {
      const saved = snap?.states?.[f.key]
      this.states.set(f.key, saved ? { ...emptyState(f.key), ...saved } : emptyState(f.key))
    }
    if (snap?.queue) this.queue = snap.queue.filter((q) => this.byKey.has(q.key)).map((q) => ({ ...q }))
    this.turn = snap?.turn ?? 0
    this.lastKey = snap?.lastKey ?? null
    this.lastPairKey = snap?.lastPairKey ?? null
  }

  /** All fact states, including facts outside the active tables when restored. */
  snapshot(): EngineSnapshot {
    const states: Record<string, FactState> = {}
    for (const [k, v] of this.states) states[k] = { ...v, fastDays: [...v.fastDays], recent: [...v.recent] }
    return {
      states,
      queue: this.queue.map((q) => ({ ...q })),
      turn: this.turn,
      lastKey: this.lastKey,
      lastPairKey: this.lastPairKey,
    }
  }

  stateOf(key: string): FactState {
    let s = this.states.get(key)
    if (!s) {
      s = emptyState(key)
      this.states.set(key, s)
    }
    return s
  }

  statusOf(key: string): Status {
    return statusOf(this.stateOf(key))
  }

  limitOf(key: string): number {
    return limitOf(this.stateOf(key))
  }

  /** Facts that may be drawn this turn: never the same fact or pair twice in a row. */
  private allowed(pool: Fact[]): Fact[] {
    // Keep a queued fact's partner out of the way, so the repeat can land on time.
    const reserved = new Set<string>()
    for (const q of this.queue) {
      const f = this.byKey.get(q.key)
      if (f) reserved.add(f.pairKey)
    }
    const fresh = (f: Fact) => f.key !== this.lastKey && f.pairKey !== this.lastPairKey
    const first = pool.filter((f) => fresh(f) && !reserved.has(f.pairKey))
    if (first.length > 0) return first
    const second = pool.filter(fresh)
    if (second.length > 0) return second
    // Rather step outside the pool than ask the same pair twice in a row.
    const third = this.facts.filter(fresh)
    if (third.length > 0) return third
    const fourth = this.facts.filter((f) => f.key !== this.lastKey)
    return fourth.length > 0 ? fourth : this.facts
  }

  private edgeFactor(f: Fact): number {
    return f.b === 1 || f.b === B_MAX ? EDGE_WEIGHT : 1
  }

  /** Weak facts: hardest and slowest first. */
  private weakWeight(f: Fact): number {
    const s = this.stateOf(f.key)
    const slow = s.rtEma === null ? 5 : Math.min(s.rtEma, 12)
    const missed = s.wrong * 3
    const fresh = s.seen === 0 ? 4 : 0
    return (1 + slow + missed + fresh) * this.edgeFactor(f)
  }

  /** Strong facts: longest unseen first. */
  private strongWeight(f: Fact): number {
    const s = this.stateOf(f.key)
    const age = s.lastSeen === 0 ? 1000 * 60 * 60 : this.now() - s.lastSeen
    return (1 + age / (1000 * 60)) * this.edgeFactor(f)
  }

  /** Pick the next question. Does not advance the turn; `record` does that. */
  next(): Selection {
    // 1. A fact that was answered wrong and is due again.
    const dueIndex = this.queue.findIndex(
      (q) => q.dueTurn <= this.turn && q.key !== this.lastKey && this.byKey.get(q.key)?.pairKey !== this.lastPairKey,
    )
    if (dueIndex >= 0) {
      const entry = this.queue[dueIndex]
      this.queue.splice(dueIndex, 1)
      const fact = this.byKey.get(entry.key)
      if (fact) return this.select(fact, 'queue')
    }

    const weak: Fact[] = []
    const strong: Fact[] = []
    for (const f of this.facts) {
      ;(isWeak(statusOf(this.stateOf(f.key))) ? weak : strong).push(f)
    }

    const wantWeak = this.rng.next() < WEAK_SHARE
    let pool: Pool = wantWeak ? 'weak' : 'strong'
    let candidates = pool === 'weak' ? weak : strong
    if (candidates.length === 0) {
      pool = pool === 'weak' ? 'strong' : 'weak'
      candidates = pool === 'weak' ? weak : strong
    }
    const allowed = this.allowed(candidates)
    const weight = pool === 'weak' ? (f: Fact) => this.weakWeight(f) : (f: Fact) => this.strongWeight(f)
    const fact = weightedPick(this.rng, allowed, weight)
    return this.select(fact, pool)
  }

  private select(fact: Fact, pool: Pool | 'queue'): Selection {
    const state = this.stateOf(fact.key)
    return { fact, state, status: statusOf(state), limit: limitOf(state), pool }
  }

  /**
   * Record an answer. `rt` is seconds from showing the sum to the last typed digit.
   * `limit` is the limit that was shown; pass the one from the Selection.
   */
  record(fact: Fact, answer: number, rt: number, limit = this.limitOf(fact.key)): AnswerOutcome {
    const state = this.stateOf(fact.key)
    const statusBefore = statusOf(state)
    const correct = answer === fact.a * fact.b
    const ts = this.now()

    state.seen += 1
    state.lastSeen = ts
    state.lastCorrect = correct
    pushRecent(state, correct)

    if (correct) {
      state.correct += 1
      state.rtEma = ema(state.rtEma, rt)
      if (rt <= FAST_SECONDS) {
        state.streakFast += 1
        const day = dayKey(ts)
        if (!state.fastDays.includes(day)) state.fastDays.push(day)
      } else {
        state.streakFast = 0
      }
    } else {
      state.wrong += 1
      state.streakFast = 0
      // Comes back within 3 turns.
      this.queue.push({ key: fact.key, dueTurn: this.turn + 1 + this.rng.int(1, 2) })
    }

    this.mirror(fact, correct, rt)

    this.turn += 1
    this.lastKey = fact.key
    this.lastPairKey = fact.pairKey

    return {
      fact,
      answer,
      correct,
      rt,
      limit,
      fast: correct && rt <= limit,
      statusBefore,
      statusAfter: statusOf(state),
    }
  }

  /** Omkeerregel: 7x8 and 8x7 inform each other, with a damped effect. */
  private mirror(fact: Fact, correct: boolean, rt: number): void {
    if (fact.a === fact.b) return
    const partnerKey = `${fact.b}x${fact.a}`
    if (!this.byKey.has(partnerKey)) return
    const partner = this.stateOf(partnerKey)
    if (correct) {
      partner.rtEma = partner.rtEma === null ? rt * 1.15 : ema(partner.rtEma, rt, 0.2)
    } else if (partner.seen > 0) {
      // Missing 7x8 means 8x7 needs another look too.
      partner.lastCorrect = false
      partner.streakFast = 0
    }
  }

  /** Marks the answer to a repaired question (typed after seeing the hint). Never scores. */
  noteRepair(fact: Fact): void {
    const state = this.stateOf(fact.key)
    state.lastSeen = this.now()
  }

  /** Facts that need the most attention, hardest first. */
  weakest(n: number): { fact: Fact; state: FactState; status: Status }[] {
    return this.facts
      .map((fact) => ({ fact, state: this.stateOf(fact.key), status: statusOf(this.stateOf(fact.key)) }))
      .filter((x) => x.state.seen > 0)
      .sort((a, b) => this.attentionScore(b) - this.attentionScore(a))
      .slice(0, n)
  }

  private attentionScore(x: { state: FactState; status: Status }): number {
    const s = x.state
    const rt = s.rtEma ?? 8
    return s.wrong * 4 + rt + (x.status === 'oefenen' ? 3 : 0)
  }
}
