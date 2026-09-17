import { dayKey } from '../engine/facts'
import type { Profile } from '../storage/schema'

export const DAY_GOAL = 2
/** Kit Nugget dozes off after this long without a round. */
export const SLEEP_AFTER_HOURS = 20

export function today(now = Date.now()): string {
  return dayKey(now)
}

/** Mild streak: a missed day costs nothing, it just does not add one. */
export function noteRound(profile: Profile, now = Date.now()): void {
  const day = today(now)
  if (profile.lastPlayedDay !== day) {
    profile.daysPlayed += 1
    profile.roundsToday = 0
    profile.lastPlayedDay = day
  }
  profile.roundsToday += 1
  profile.roundsPlayed += 1
  profile.lastPlayedAt = now
}

export function roundsToday(profile: Profile, now = Date.now()): number {
  return profile.lastPlayedDay === today(now) ? profile.roundsToday : 0
}

export function isAsleep(profile: Profile, now = Date.now()): boolean {
  if (!profile.lastPlayedAt) return false
  return now - profile.lastPlayedAt > SLEEP_AFTER_HOURS * 3600 * 1000
}
