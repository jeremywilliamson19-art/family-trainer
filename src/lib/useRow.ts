import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/**
 * Loads one record through a get action and saves partial updates
 * optimistically through the matching save action.
 */
export function useRow<T extends object>(getAction: string, saveAction: string, params: Record<string, unknown> | null) {
  const [row, setRow] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(params)

  useEffect(() => {
    if (!params) return
    api<T>(getAction, params).then(setRow, (e) => setError((e as Error).message))
  }, [getAction, key])

  const save = useCallback(
    async (patch: Partial<T>) => {
      if (!params) return
      const before = row
      setRow((r) => (r ? { ...r, ...patch } : r))
      try {
        setRow(await api<T>(saveAction, { ...params, patch }))
        setError(null)
      } catch (e) {
        setRow(before)
        setError((e as Error).message)
      }
    },
    [saveAction, key, row],
  )

  return { row, save, error }
}
