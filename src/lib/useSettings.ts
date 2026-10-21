import { useEffect, useState } from 'react'
import { api } from './api'
import type { MemberSettings } from './types'

let cache: MemberSettings | null = null

/** The signed-in member's settings (cached for the session). */
export function useSettings(): MemberSettings | null {
  const [s, setS] = useState(cache)
  useEffect(() => {
    api<MemberSettings>('getSettings').then((v) => {
      cache = v
      setS(v)
    }, () => {})
  }, [])
  return s
}

export function invalidateSettings() {
  cache = null
}
