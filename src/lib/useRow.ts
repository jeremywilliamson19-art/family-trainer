import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Loads one row by key and saves partial updates optimistically.
 * Used for the per-member settings tables.
 */
export function useRow<T extends object>(table: string, keyColumn: string, keyValue: string | undefined) {
  const [row, setRow] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!keyValue) return
    supabase
      .from(table)
      .select('*')
      .eq(keyColumn, keyValue)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRow(data as T | null)
      })
  }, [table, keyColumn, keyValue])

  const save = useCallback(
    async (patch: Partial<T>) => {
      if (!keyValue) return
      const before = row
      setRow((r) => (r ? { ...r, ...patch } : r))
      const { error } = await supabase.from(table).update(patch as never).eq(keyColumn, keyValue)
      if (error) {
        setRow(before)
        setError(error.message)
      } else {
        setError(null)
      }
    },
    [table, keyColumn, keyValue, row],
  )

  return { row, save, error }
}
