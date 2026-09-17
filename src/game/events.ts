/** Everything the scene is allowed to know about. No sums, no engine types. */
export type SceneEvent =
  | { type: 'bigJump'; metres: number }
  | { type: 'smallStep'; metres: number }
  | { type: 'stay' }
  | { type: 'combo'; n: number }
  | { type: 'itemCollected'; id: string }
  | { type: 'zoneChanged'; id: string }
  | { type: 'roundEnd' }
  | { type: 'roundStart' }

export type SceneEventHandler = (event: SceneEvent) => void
