// The member's nutrition data, offline-first (see syncStore).
import type { Targets } from './macros'
import { addDays, localDate } from './nutrition'
import { api } from './api'
import { createSyncStore, type SyncMeta } from './syncStore'
import type { ChildTargets, Favorite, Food, Meal } from './types'

export { newId } from './syncStore'

export type Op =
  | { type: 'saveMeal'; meal: Meal }
  | { type: 'deleteMeal'; id: string }
  | { type: 'saveFood'; food: Food }
  | { type: 'saveFavorite'; favorite: Favorite }
  | { type: 'deleteFavorite'; id: string }

interface NutritionData {
  /** undefined = never loaded; null = no targets yet (needs setup). */
  targets: Targets | ChildTargets | null | undefined
  meals: Meal[]
  foods: Food[]
  favorites: Favorite[]
}

export type NutritionState = NutritionData & SyncMeta<Op>

const HISTORY_DAYS = 90

const store = createSyncStore<NutritionData, Op>({
  name: 'ft:nutrition',
  empty: { targets: undefined, meals: [], foods: [], favorites: [] },
  apply(s, op) {
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
  },
  send(op) {
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
  },
  pull: () => api<NutritionData>('nutritionSync', { from: addDays(localDate(), -HISTORY_DAYS) }),
})

export const startNutrition = store.start
export const stopNutrition = store.stop
export const refresh = store.refresh
export const mutate = store.mutate
export const useNutrition: () => NutritionState = store.use
