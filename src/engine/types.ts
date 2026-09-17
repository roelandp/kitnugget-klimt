export type Status = 'nieuw' | 'oefenen' | 'snel' | 'geautomatiseerd'

export type Pool = 'weak' | 'strong'

/** A single multiplication fact. `7x8` and `8x7` are distinct facts sharing a pairKey. */
export interface Fact {
  key: string
  a: number
  b: number
  pairKey: string
}

export interface FactState {
  key: string
  seen: number
  correct: number
  wrong: number
  /** Exponential moving average of reaction time (seconds) on correct answers. */
  rtEma: number | null
  /** Consecutive correct answers within FAST_SECONDS. */
  streakFast: number
  /** Distinct YYYY-MM-DD dates on which this fact was answered fast and correct. */
  fastDays: string[]
  lastSeen: number
  lastCorrect: boolean | null
  /** Most recent results, newest last, capped at RECENT_WINDOW. */
  recent: boolean[]
}

export interface AnswerOutcome {
  fact: Fact
  answer: number
  correct: boolean
  /** Reaction time in seconds. */
  rt: number
  /** Time limit that applied to this question, in seconds. */
  limit: number
  /** Correct and within the limit. */
  fast: boolean
  statusBefore: Status
  statusAfter: Status
}
