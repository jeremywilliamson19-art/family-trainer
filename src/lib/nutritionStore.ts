// Offline-first nutrition data. Every change is applied locally at once and
// queued; the queue flushes to the server in order whenever we're online.
// Server saves are idempotent by id, so retrying after a dropped connection
// is safe.
import { useSyncExternalStore } from 'react'
import type { Targets } from './macros'
import { addDays, localDate } from './nutrition'
import { api, ApiError } from './api'
import type { ChildTargets, Favorite, Food, Meal } from './types'

export type Op =
  | { type: 'saveMeal'; meal: Meal }
  | { type: 'deleteMeal'; id: string }
  | { type: 'saveFood'; food: Food }
  | { type: 'saveFavorite'; favorite: Favorite }
  | { type: 'deleteFavorite'; id: string }

export interface NutritionState {
  /** undefined = never loaded; null = no targets yet (needs setup). */
  targets: Targets | ChildTargets | null | undefined
  meals: Meal[]
  foods: Food[]
  favorites: Favorite[]
  outbox: Op[]
  syncing: boolean
  error: string | null
}

const HISTORY_DAYS = 90
const EMPTY: NutritionState = { targets: undefined, meals: [], foods: [], favorites: [], outbox: [], syncing: false, error: null }

let memberId: string | null = null
let state: NutritionState = EMPTY
const listeners = new Set<() => void>()

const storageKey = () => `ft:nutrition:${memberId}`

function persist() {
  try {
    const { syncing: _s, error: _e, ...keep } = state
    localStorage.setItem(storageKey(), JSON.stringify(keep))
  } catch {
    /* storage full or unavailable: the server copy is still the source of truth */
  }
}

function set(patch: Partial<NutritionState>) {
  state = { ...state, ...patch }
  persist()
  listeners.forEach((l) => l())
}

/** Applies an op to local state (also used to re-apply pending ops after a sync). */
function apply(s: NutritionState, op: Op): Partial<NutritionState> {
  switch (op.type) {
    case 'saveMeal':
      return { meals: [...s.meals.filter((m) => m.id !== op.meal.id), op.meal] }
    case 'deleteMeal':
      return { meals: s.meals.filter((m) => m.id !== op.id) }
    case 'saveFood':
      return { foods: [...s.foods.filter((f) => f.id !== op.food.id), op.food] }
    case 'saveFavorite':
      return { favorites: [...s.favorites.filter((f) => f.id !== op.favorite.id), op.favorite] }
    case 'deleteFavorite':
      return { favorites: s.favorites.filter((f) => f.id !== op.id) }
  }
}

function send(op: Op) {
  switch (op.type) {
    case 'saveMeal':
      return api('saveMeal', { meal: op.meal })
    case 'deleteMeal':
      return api('deleteMeal', { id: op.id })
    case 'saveFood':
      return api('saveFood', { food: op.food })
    case 'saveFavorite':
      return api('saveFavorite', { favorite: op.favorite })
    case 'deleteFavorite':
      return api('deleteFavorite', { id: op.id })
  }
}

let flushing: Promise<void> | null = null

/** Sends queued changes in order. Network errors leave them queued. */
function flush(): Promise<void> {
  // Clear the marker in .finally (always async). Clearing it inside the async
  // body would run before ??= assigns when the queue is already empty, leaving
  // a stale promise that blocks every later flush.
  flushing ??= (async () => {
    {
      while (state.outbox.length) {
        const op = state.outbox[0]
        try {
          await send(op)
        } catch (e) {
          if (e instanceof ApiError && (e.code === 'network' || e.code === 'busy' || e.code === 'server')) return
          // The server rejected it (bad data); drop it so the queue isn't stuck.
          set({ error: (e as Error).message })
        }
        set({ outbox: state.outbox.slice(1) })
      }
    }
  })().finally(() => {
    flushing = null
  })
  return flushing
}

/** Pushes pending changes, then pulls the latest from the server. */
export async function refresh() {
  if (!memberId) return
  set({ syncing: true })
  try {
    await flush()
    const from = addDays(localDate(), -HISTORY_DAYS)
    const data = await api<Pick<NutritionState, 'targets' | 'meals' | 'foods' | 'favorites'>>('nutritionSync', { from })
    // Keep anything queued while we were fetching.
    let next: NutritionState = { ...state, ...data }
    for (const op of state.outbox) next = { ...next, ...apply(next, op) }
    set({ ...next, syncing: false, error: null })
  } catch (e) {
    set({ syncing: false, error: (e as ApiError).code === 'network' ? null : (e as Error).message })
  }
}

export function mutate(op: Op) {
  set({ ...apply(state, op), outbox: [...state.outbox, op], error: null })
  void flush()
}

/** Loads the cached copy for this member and starts syncing. */
export function startNutrition(id: string) {
  if (memberId === id) return
  memberId = id
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey()) ?? 'null')
    state = cached ? { ...EMPTY, ...cached } : EMPTY
  } catch {
    state = EMPTY
  }
  listeners.forEach((l) => l())
  void refresh()
}

export function stopNutrition() {
  memberId = null
  state = EMPTY
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void refresh())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh()
  })
}

export function useNutrition(): NutritionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const newId = () => crypto.randomUUID()
