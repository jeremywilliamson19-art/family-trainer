// Talks to the Apps Script web app. POST with text/plain is a "simple"
// request, so browsers skip the CORS preflight Apps Script can't answer.
const API_URL = import.meta.env.VITE_API_URL as string | undefined
const TOKEN_KEY = 'ft:token'

export const isConfigured = Boolean(API_URL)

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: session lasts until the app closes */
  }
}

export async function api<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: getToken(), ...params }),
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('network', 'Can’t reach the server. Check your connection and try again.')
  }
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string; code?: string } | null
  if (!json) throw new ApiError('server', 'Something went wrong. Try again.')
  if (!json.ok) {
    if (json.code === 'auth') window.dispatchEvent(new Event('ft:signed-out'))
    throw new ApiError(json.code ?? 'server', json.error ?? 'Something went wrong.')
  }
  return json.data as T
}
