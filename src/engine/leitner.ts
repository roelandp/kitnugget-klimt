
import { makeRng, type Rng } from './rng';

export type LeitnerBox = 0 | 1 | 2 | 3 | 4;

export interface SumState {
  key: string;      // e.g. "3x4" (we normalize a<=b)
  box: LeitnerBox;
  lastSeenDay: string | null;
  history: ('clean' | 'hint' | 'wrong' | 'timeout')[];
  // To track conquest (3 distinct days of clean first try)
  cleanDays: string[];
  isConquered: boolean;
  // If true, needs to be shown after 2 other questions
  pendingReview: number; 
}

export interface LeitnerSettings {
  targetSuccessRate: [number, number]; // e.g. [0.85, 0.90]
  wobblyThresholds: [number, number];  // e.g. [0.80, 0.92]
  boxIntervals: number[];              // e.g. [0, 0, 1, 2, 4]
  maxWobbly: number;                   // e.g. 3
}

export const DEFAULT_SETTINGS: LeitnerSettings = {
  targetSuccessRate: [0.85, 0.90],
  wobblyThresholds: [0.80, 0.92],
  boxIntervals: [0, 0, 1, 2, 4],
  maxWobbly: 3,
};

export function getAllSums(tables: number[]): string[] {
  const sums: string[] = [];
  for (const a of tables) {
    for (let b = 1; b <= 10; b++) {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const key = `${min}x${max}`;
      if (!sums.includes(key)) sums.push(key);
    }
  }
  return sums;
}

export function getHardSums(tables: number[]): string[] {
  const knownFactors = [1, 2, 5, 10];
  const all = getAllSums(tables);
  return all.filter(key => {
    const [a, b] = key.split('x').map(Number);
    return !knownFactors.includes(a) && !knownFactors.includes(b);
  });
}

export interface LeitnerSnapshot {
  states: Record<string, SumState>;
  recentAnswers: boolean[]; // last 10 answers
  lastShown: string | null;
}

export type SelectionType = 'hard' | 'known' | 'review';

export interface LeitnerSelection {
  key: string;       // Normalized, e.g. "3x7"
  display: string;   // How to show it, e.g. "3 x 7" or "7 x 3"
  a: number;
  b: number;
  box: LeitnerBox;
  type: SelectionType;
  timer: number | null; // e.g. 6 if box 4, else null
}

export class LeitnerEngine {
  private states = new Map<string, SumState>();
  private recentAnswers: boolean[] = [];
  private lastShown: string | null = null;
  private rng: Rng;
  private settings: LeitnerSettings;
  private now: () => number;
  
  // All possible sums (normalized a<=b)
  private allSums: string[] = [];

    public readonly hardSums: string[];
  public readonly tables: number[];

  constructor(tables: number[], snapshot: Partial<LeitnerSnapshot> = {}, seed?: number, now?: () => number, settings = DEFAULT_SETTINGS) {
    this.rng = makeRng(seed ?? (Date.now() & 0x7fffffff));
    this.now = now ?? (() => Date.now());
    this.settings = settings;
    this.tables = tables;
    
    this.allSums = getAllSums(tables);
    this.hardSums = getHardSums(tables);

    if (snapshot.recentAnswers) this.recentAnswers = [...snapshot.recentAnswers];
    this.lastShown = snapshot.lastShown ?? null;

    for (const key of this.allSums) {
      if (snapshot.states && snapshot.states[key]) {
        const s = snapshot.states[key];
        this.states.set(key, {
          key,
          box: s.box,
          lastSeenDay: s.lastSeenDay,
          history: [...s.history],
          cleanDays: [...(s.cleanDays || [])],
          isConquered: !!s.isConquered,
          pendingReview: s.pendingReview ?? 0,
        });
      } else {
        const isHard = this.hardSums.includes(key);
        this.states.set(key, {
          key,
          box: isHard ? 0 : 3,
          lastSeenDay: null,
          history: [],
          cleanDays: [],
          isConquered: false,
          pendingReview: 0,
        });
      }
    }
  }

  snapshot(): LeitnerSnapshot {
    const states: Record<string, SumState> = {};
    for (const [k, v] of this.states) {
      states[k] = { ...v, history: [...v.history], cleanDays: [...v.cleanDays] };
    }
    return {
      states,
      recentAnswers: [...this.recentAnswers],
      lastShown: this.lastShown,
    };
  }

  private currentDay(): string {
    const d = new Date(this.now());
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  
  private parseDay(d: string): number {
    return new Date(d).getTime();
  }

  private isDue(state: SumState): boolean {
    if (state.box === 0) return true; // new
    if (!state.lastSeenDay) return true;
    const interval = this.settings.boxIntervals[state.box] ?? 0;
    if (interval === 0) return true;
    const dayMs = 24 * 60 * 60 * 1000;
    const passed = (this.parseDay(this.currentDay()) - this.parseDay(state.lastSeenDay)) / dayMs;
    return passed >= interval;
  }

  private getWobbly(): SumState[] {
    return Array.from(this.states.values()).filter(s => s.box === 1 || s.box === 2);
  }
  
  private getSuccessRate(): number {
    if (this.recentAnswers.length === 0) return 1.0;
    const sum = this.recentAnswers.reduce((a, b) => a + (b ? 1 : 0), 0);
    return sum / this.recentAnswers.length;
  }

  next(): LeitnerSelection {
    const sr = this.getSuccessRate();
    const wobbly = this.getWobbly();
    

    // 1. Pending review (after mistake)
    // Pending review logic: we decrement pendingReview every turn a DIFFERENT sum is asked.
    // Wait, the rule is "De foute som komt na 2 andere vragen terug".
    // So if pendingReview == 1, it becomes 0 and gets asked.
    const reviews = Array.from(this.states.values()).filter(s => s.pendingReview === 1 && s.key !== this.lastShown);
    if (reviews.length > 0) {
      // Pick one randomly
      const state = reviews[Math.floor(this.rng.next() * reviews.length)];
      return this.formatSelection(state, 'review');
    }

    let pickType: SelectionType = 'known';
    if (sr < this.settings.wobblyThresholds[0]) {
      pickType = 'known';
    } else if (sr > this.settings.wobblyThresholds[1]) {
      pickType = 'hard'; // meaning wobbly or new
    } else {
      pickType = this.rng.next() < 0.35 ? 'hard' : 'known';
    }

    let pool: SumState[] = [];

    if (pickType === 'hard') {
      // Collect wobbly and new
      const dueWobbly = wobbly.filter(s => this.isDue(s) && s.key !== this.lastShown);
      if (dueWobbly.length > 0) {
        pool = dueWobbly;
      } else {
        // Introduce new if room
        if (wobbly.length < this.settings.maxWobbly) {
          const newHard = Array.from(this.states.values()).filter(s => s.box === 0 && this.hardSums.includes(s.key) && s.key !== this.lastShown);
          // Sort by product size
          newHard.sort((a, b) => {
            const [a1, a2] = a.key.split('x').map(Number);
            const [b1, b2] = b.key.split('x').map(Number);
            return (a1*a2) - (b1*b2);
          });
          if (newHard.length > 0) {
            pool = [newHard[0]]; // Pick the smallest product
          }
        }
      }
    }

    if (pool.length === 0) {
      // Fallback to known
      pickType = 'known';
      const knowns = Array.from(this.states.values()).filter(s => (!this.hardSums.includes(s.key) || s.box >= 3) && s.key !== this.lastShown);
      const dueKnowns = knowns.filter(s => this.isDue(s));
      pool = dueKnowns.length > 0 ? dueKnowns : knowns;
      
      // Weigh towards lower box
      pool.sort((a, b) => a.box - b.box);
      // Take top 3 and pick random
      pool = pool.slice(0, 3);
    }

    if (pool.length === 0) {
      pool = Array.from(this.states.values()).filter(s => s.key !== this.lastShown);
    }
    
    const picked = pool[Math.floor(this.rng.next() * pool.length)];
    return this.formatSelection(picked, pickType);
  }

  private formatSelection(state: SumState, type: SelectionType): LeitnerSelection {
    const [a, b] = state.key.split('x').map(Number);
    let displayA = a;
    let displayB = b;
    if (a !== b) {
      const aSelected = this.tables.includes(a);
      const bSelected = this.tables.includes(b);
      
      if (aSelected && !bSelected) {
        // e.g. a=3(selected), b=1(not) -> display 1 x 3 (table of 3)
        displayA = b;
        displayB = a;
      } else if (bSelected && !aSelected) {
        // e.g. a=1(not), b=3(selected) -> display 1 x 3
        displayA = a;
        displayB = b;
      } else {
        if (this.rng.next() > 0.5) {
          displayA = b;
          displayB = a;
        }
      }
    }
    return {
      key: state.key,
      display: `${displayA} x ${displayB}`,
      a: displayA,
      b: displayB,
      box: state.box,
      type,
      timer: state.box === 4 ? 6 : null,
    };
  }

  record(key: string, outcome: 'clean' | 'hint' | 'wrong' | 'timeout'): void {
    const state = this.states.get(key);
    if (!state) return;
    const day = this.currentDay();

    // Decrement pending review for all others
    for (const s of this.states.values()) {
      if (s.key !== key && s.pendingReview > 0) {
        s.pendingReview--;
      }
    }

    // Update history
    state.history.push(outcome);
    
    
    // Update success rate logic (timeout doesn't count as wrong for SR)
    if (outcome !== 'hint') {
      this.recentAnswers.push(outcome === 'clean');
      if (this.recentAnswers.length > 10) this.recentAnswers.shift();
    }
    
    if (outcome === 'wrong') {
      // If wrong, drops to box 1. (Conquered items stay conquered but drop to box 2 conceptually, let's say box 2 for conquered)
      state.box = state.isConquered ? 2 : 1;
      state.pendingReview = 3; // will be decremented next 2 turns, so it appears after 2 other questions
    } else if (outcome === 'timeout') {
      // Drops 1 box
      state.box = Math.max(0, state.box - 1) as LeitnerBox;
    } else if (outcome === 'hint') {
      // Good with hint: no box gain
    } else if (outcome === 'clean') {
      // Check if it's pending review being answered correctly
      if (state.pendingReview === 0) {
        // Normal clean answer -> gain box
        state.box = Math.min(4, state.box + 1) as LeitnerBox;
        
        // Conquest logic
        if (this.hardSums.includes(key)) {
          if (!state.cleanDays.includes(day)) {
            // Is it the first attempt of the day?
            // Actually, we need to know if there were prior attempts today.
            // But we can simplify: if cleanDays doesn't have it, and we got it clean, add it.
            // Wait, "op 3 verschillende dagen de eerste poging van die dag goed, zonder hint en zonder timeout".
             
            // wait, lastSeenDay is updated below.
            // So prior to this, lastSeenDay is the LAST time we saw it.
            // We can just track "hasFailedToday". If we just add to cleanDays if the day is new.
            if (state.lastSeenDay !== day) {
               state.cleanDays.push(day);
               if (state.cleanDays.length >= 3) {
                 state.isConquered = true;
               }
            }
          }
        }
      } else {
        // Repaired after wrong -> no box gain, clear pending
        state.pendingReview = 0;
      }
    }

    state.lastSeenDay = day;
    this.lastShown = key;
  }
}
