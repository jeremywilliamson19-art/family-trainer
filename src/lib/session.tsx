import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import { stopNutrition } from './nutritionStore'
import type { Member } from './types'

type Status = 'loading' | 'signed-out' | 'ready' | 'error'

interface SessionValue {
  status: Status
  member: Member | null
  error: string | null
  reload: () => Promise<void>
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionValue | null>(null)
const MEMBER_KEY = 'ft:member'

function cachedMember(): Member | null {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Start from the cached member so the app opens instantly (and offline).
  const [member, setMember] = useState<Member | null>(() => (getToken() ? cachedMember() : null))
  const [status, setStatus] = useState<Status>(() => (!getToken() ? 'signed-out' : cachedMember() ? 'ready' : 'loading'))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!getToken()) {
      setMember(null)
      setStatus('signed-out')
      return
    }
    try {
      const m = await api<Member>('me')
      localStorage.setItem(MEMBER_KEY, JSON.stringify(m))
      setMember(m)
      setStatus('ready')
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'auth') return // handled by the signed-out event
      // Offline with a cached member: keep going.
      if (code === 'network' && cachedMember()) return
      setError((e as Error).message)
      setStatus('error')
    }
  }, [])

  const clear = useCallback(() => {
    setToken(null)
    stopNutrition()
    try {
      localStorage.removeItem(MEMBER_KEY)
    } catch {
      /* ignore */
    }
    setMember(null)
    setStatus('signed-out')
  }, [])

  useEffect(() => {
    reload()
    window.addEventListener('ft:signed-out', clear)
    return () => window.removeEventListener('ft:signed-out', clear)
  }, [reload, clear])

  const value: SessionValue = {
    status,
    member,
    error,
    reload,
    signIn: async (token) => {
      setToken(token)
      setStatus('loading')
      await reload()
    },
    signOut: async () => {
      await api('signOut').catch(() => {})
      clear()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}

/** For screens that only render once signed in. */
export function useMember(): Member {
  const { member } = useSession()
  if (!member) throw new Error('useMember before ready')
  return member
}
