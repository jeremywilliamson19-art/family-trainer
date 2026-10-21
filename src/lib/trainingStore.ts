// The member's programs and workouts, offline-first (see syncStore), plus
// the workout in progress, which lives only on this phone until Finish.
import { useSyncExternalStore } from 'react'
import { api } from './api'
import { createSyncStore, type SyncMeta } from './syncStore'
import type { Measurement, Program, TestRecord, Workout } from './types'

export type TrainingOp =
  | { type: 'saveProgram'; program: Program }
  | { type: 'deleteProgram'; id: string }
  | { type: 'saveWorkout'; workout: Workout }
  | { type: 'deleteWorkout'; id: string }
  | { type: 'saveTest'; record: TestRecord }
  | { type: 'deleteTest'; id: string }
  | { type: 'saveMeasurement'; measurement: Measurement }
  | { type: 'deleteMeasurement'; id: string }

export interface YouthLimits {
  in_season: boolean
  foot_contact_cap: number
}

interface TrainingData {
  programs: Program[]
  workouts: Workout[]
  tests: TestRecord[]
  measurements: Measurement[]
  /** Set for the son's account (from the parent's settings). */
  limits: YouthLimits | null
  loaded: boolean
}

export type TrainingState = TrainingData & SyncMeta<TrainingOp>


const upsert = <T extends { id: string }>(list: T[], row: T) => [...list.filter((x) => x.id !== row.id), row]

const store = createSyncStore<TrainingData, TrainingOp>({
  name: 'ft:training',
  empty: { programs: [], workouts: [], tests: [], measurements: [], limits: null, loaded: false },
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
      case 'saveTest':
        return { tests: upsert(s.tests, op.record) }
      case 'deleteTest':
        return { tests: s.tests.filter((t) => t.id !== op.id) }
      case 'saveMeasurement':
        return { measurements: upsert(s.measurements, op.measurement) }
      case 'deleteMeasurement':
        return { measurements: s.measurements.filter((m) => m.id !== op.id) }
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
      case 'saveTest':
        return api('saveTest', { record: op.record })
      case 'deleteTest':
        return api('deleteTest', { id: op.id })
      case 'saveMeasurement':
        return api('saveMeasurement', { measurement: op.measurement })
      case 'deleteMeasurement':
        return api('deleteMeasurement', { id: op.id })
    }
  },
  // All history: Progress compares against each member's very first session.
  pull: async () => ({ ...(await api<Omit<TrainingData, 'loaded'>>('trainingSync', { from: '0000-00-00' })), loaded: true }),
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
