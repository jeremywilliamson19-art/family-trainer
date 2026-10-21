import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Meal } from './types'

// Minimal browser globals for the store.
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
})

const calls: string[] = []
let online = true
vi.mock('./api', () => {
  class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message)
    }
  }
  return {
    ApiError,
    api: vi.fn(async (action: string, p: { meal?: Meal }) => {
      if (!online) throw new ApiError('network', 'offline')
      calls.push(action === 'saveMeal' ? `saveMeal:${p.meal!.id}` : action)
      if (action === 'nutritionSync') return { targets: null, meals: [], foods: [], favorites: [] }
      return { ok: true }
    }),
  }
})

const store = await import('./nutritionStore')
const meal = (id: string): Meal => ({ id, member_id: 'm', date: '2026-10-21', meal_type: 'lunch', items: [], logged_at: '2026-10-21T12:00:00Z' })
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('offline queue', () => {
  beforeEach(async () => {
    online = true
    store.stopNutrition()
    mem.clear()
    store.startNutrition('m')
    await tick()
    calls.length = 0 // ignore the startup sync
  })

  it('sends a save made after an empty-queue sync (regression)', async () => {
    store.mutate({ type: 'saveMeal', meal: meal('a') })
    await tick()
    store.mutate({ type: 'saveMeal', meal: meal('b') })
    await tick()
    expect(calls.filter((c) => c.startsWith('saveMeal'))).toEqual(['saveMeal:a', 'saveMeal:b'])
  })

  it('keeps changes made offline and sends them in order when back online', async () => {
    online = false
    store.mutate({ type: 'saveMeal', meal: meal('x') })
    store.mutate({ type: 'deleteMeal', id: 'x' })
    await tick()
    expect(calls).toEqual([])
    // Survives an app restart.
    store.stopNutrition()
    store.startNutrition('m')
    await tick()
    online = true
    await store.refresh()
    expect(calls).toEqual(['saveMeal:x', 'deleteMeal', 'nutritionSync'])
  })
})
