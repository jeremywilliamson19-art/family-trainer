import { isIOS, isStandalone } from './platform'
import { callFunction, supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState =
  | 'unsupported' // browser has no Web Push at all
  | 'needs-install' // iOS: only works from the home-screen app
  | 'default' // never asked
  | 'denied' // user said no; must fix in iOS Settings
  | 'granted-unsubscribed' // allowed, but this device isn't registered
  | 'subscribed'

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ? 'subscribed' : 'granted-unsubscribed'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: auth.user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/**
 * Asks for permission (must run inside a tap handler on iOS) and registers
 * this device. Returns the resulting state.
 */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Push is not configured (missing VAPID public key)')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  await saveSubscription(sub)
  return 'subscribed'
}

/** "Fix it": throw away this device's subscription and make a fresh one. */
export async function resetPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready
  const old = await reg.pushManager.getSubscription()
  if (old) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', old.endpoint)
    await old.unsubscribe().catch(() => {})
  }
  return enablePush()
}

/** Re-saves the current subscription; call on app start in case it rotated. */
export async function syncPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) await saveSubscription(sub).catch(() => {})
}

export function sendTestPush() {
  return callFunction<{ sent: number; devices: number }>('push-test')
}
