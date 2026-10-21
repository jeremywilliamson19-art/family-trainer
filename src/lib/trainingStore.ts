// The member's programs and workouts, offline-first (see syncStore), plus
// the workout in progress, which lives only on this phone until Finish.
import { useSyncExternalStore } from 'react'
import { api } from './api'
import { addDays, localDate } from './nutrition'
import { createSyncStore, type SyncMeta } from './syncStore'
import type { Program, Workout } from './types'

export type TrainingOp =
  | { type: 'saveProgram'; program: Program }
  | { type: 'deleteProgram'; id: string }
  | { type: 'saveWorkout'; workout: Workout }
  | { type: 'deleteWorkout'; id: string }

export interface YouthLimits {
  in_season: boolean
  foot_contact_cap: number
}

interface TrainingData {
  programs: Program[]
  workouts: Workout[]
  /** Set for the son's account (from the parent's settings). */
  limits: YouthLimits | null
  loaded: boolean
}

export type TrainingState = TrainingData & SyncMeta<TrainingOp>

/** Six months covers progression, PRs and plateau checks. */
const HISTORY_DAYS = 183

const upsert = <T extends { id: string }>(list: T[], row: T) => [...list.filter((x) => x.id !== row.id), row]

const store = createSyncStore<TrainingData, TrainingOp>({
  name: 'ft:training',
  empty: { programs: [], workouts: [], limits: null, loaded: false },
  apply(s, op) {
    switch (op.type) {
      case 'saveProgram':
        return { programs: upsert(s.programs, op.program) }
      case 'deleteProgram':
        return { programs: s.programs.filter((p) => p.id !== op.id) }
      case 'saveWorkout':
        return { workouts: upsert(s.workouts, op.workout) }
      case 'deleteWorkout':
        return { workouts: s.workouts.filter((w) => w.id !== op.id) }
    }
  },
  send(op) {
    switch (op.type) {
      case 'saveProgram':
        return api('saveProgram', { program: op.program })
      case 'deleteProgram':
        return api('deleteProgram', { id: op.id })
      case 'saveWorkout':
        return api('saveWorkout', { workout: op.workout })
      case 'deleteWorkout':
        return api('deleteWorkout', { id: op.id })
    }
  },
  pull: async () => ({ ...(await api<Omit<TrainingData, 'loaded'>>('trainingSync', { from: addDays(localDate(), -HISTORY_DAYS) })), loaded: true }),
})

export const startTraining = store.start
export const stopTraining = store.stop
export const refreshTraining = store.refresh
export const mutateTraining = store.mutate
export const useTraining: () => TrainingState = store.use

// ---------------------------------------------------------------------------
// The workout in progress (local only)
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'ft:workout-draft'
let draft: Workout | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
  } catch {
    return null
  }
})()
const draftListeners = new Set<() => void>()

export function setDraft(w: Workout | null) {
  draft = w
  try {
    if (w) localStorage.setItem(DRAFT_KEY, JSON.stringify(w))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore: the draft just won't survive closing the app */
  }
  draftListeners.forEach((l) => l())
}

export function useDraft(): Workout | null {
  return useSyncExternalStore(
    (l) => {
      draftListeners.add(l)
      return () => draftListeners.delete(l)
    },
    () => draft,
  )
}
