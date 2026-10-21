import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in is by typed code, never by URL, so don't parse the address bar.
    detectSessionInUrl: false,
  },
})

/** Calls an edge function and turns its { error } body into a thrown Error. */
export async function callFunction<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx instanceof Response ? await ctx.json().then((j) => j?.error).catch(() => null) : null
    throw new Error(msg ?? error.message)
  }
  return data as T
}
