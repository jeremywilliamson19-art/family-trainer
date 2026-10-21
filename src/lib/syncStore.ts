// Offline-first synced data. Every change is applied locally at once and
// queued; the queue flushes to the server in order whenever we're online.
// Server saves are idempotent by id, so retrying after a dropped connection
// is safe. Used by the nutrition and training stores.
import { useSyncExternalStore } from 'react'
import { ApiError } from './api'

export interface SyncMeta<Op> {
  outbox: Op[]
  syncing: boolean
  error: string | null
}

export interface SyncConfig<D, Op> {
  /** localStorage prefix; the member id is appended. */
  name: string
  empty: D
  apply(data: D, op: Op): Partial<D>
  send(op: Op): Promise<unknown>
  pull(): Promise<Partial<D>>
}

export function createSyncStore<D extends object, Op>(cfg: SyncConfig<D, Op>) {
  type State = D & SyncMeta<Op>
  const EMPTY = { ...cfg.empty, outbox: [], syncing: false, error: null } as State

  let memberId: string | null = null
  let state: State = EMPTY
  const listeners = new Set<() => void>()
  const storageKey = () => `${cfg.name}:${memberId}`

  function persist() {
    try {
      const { syncing: _s, error: _e, ...keep } = state
      localStorage.setItem(storageKey(), JSON.stringify(keep))
    } catch {
      /* storage full or unavailable: the server copy is still the source of truth */
    }
  }

  function set(patch: Partial<State>) {
    state = { ...state, ...patch }
    persist()
    listeners.forEach((l) => l())
  }

  let flushing: Promise<void> | null = null

  /** Sends queued changes in order. Network errors leave them queued. */
  function flush(): Promise<void> {
    // Clear the marker in .finally (always async). Clearing it inside the async
    // body would run before ??= assigns when the queue is already empty, leaving
    // a stale promise that blocks every later flush.
    flushing ??= (async () => {
      while (state.outbox.length) {
        const op = state.outbox[0]
        try {
          await cfg.send(op)
        } catch (e) {
          if (e instanceof ApiError && (e.code === 'network' || e.code === 'busy' || e.code === 'server')) return
          // The server rejected it (bad data); drop it so the queue isn't stuck.
          set({ error: (e as Error).message } as Partial<State>)
        }
        set({ outbox: state.outbox.slice(1) } as Partial<State>)
      }
    })().finally(() => {
      flushing = null
    })
    return flushing
  }

  /** Pushes pending changes, then pulls the latest from the server. */
  async function refresh() {
    if (!memberId) return
    set({ syncing: true } as Partial<State>)
    try {
      await flush()
      const data = await cfg.pull()
      // Keep anything queued while we were fetching.
      let next = { ...state, ...data } as State
      for (const op of state.outbox) next = { ...next, ...cfg.apply(next, op) }
      set({ ...next, syncing: false, error: null })
    } catch (e) {
      set({ syncing: false, error: (e as ApiError).code === 'network' ? null : (e as Error).message } as Partial<State>)
    }
  }

  function mutate(op: Op) {
    set({ ...cfg.apply(state, op), outbox: [...state.outbox, op], error: null } as Partial<State>)
    void flush()
  }

  /** Loads the cached copy for this member and starts syncing. */
  function start(id: string) {
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

  function stop() {
    memberId = null
    state = EMPTY
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void refresh())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refresh()
    })
  }

  function use(): State {
    return useSyncExternalStore(
      (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      () => state,
    )
  }

  return { start, stop, refresh, mutate, use, get: () => state }
}

export const newId = () => crypto.randomUUID()
