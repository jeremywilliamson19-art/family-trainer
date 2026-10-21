import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Member } from './types'

type Status = 'loading' | 'signed-out' | 'not-invited' | 'ready' | 'error'

interface SessionValue {
  status: Status
  session: Session | null
  member: Member | null
  error: string | null
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadMember = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setMember(null)
      setStatus('signed-out')
      return
    }
    try {
      // Joins from an invite (or bootstraps the household) on first sign-in.
      const { data: joined, error: joinErr } = await supabase.rpc('join_household')
      if (joinErr) throw joinErr
      if (joined?.status === 'not_invited') {
        setMember(null)
        setStatus('not-invited')
        return
      }
      const { data, error: memErr } = await supabase.from('members').select('*').eq('id', s.user.id).single()
      if (memErr) throw memErr
      setMember(data as Member)
      setStatus('ready')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadMember(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes don't change who is signed in.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => loadMember(s), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadMember])

  const value: SessionValue = {
    status,
    session,
    member,
    error,
    reload: () => loadMember(session),
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}

/** For screens that only render once signed in as a household member. */
export function useMember(): Member {
  const { member } = useSession()
  if (!member) throw new Error('useMember before ready')
  return member
}
