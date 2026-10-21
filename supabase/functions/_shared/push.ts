import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export interface PushMessage {
  title: string
  body: string
  /** In-app path to open when the notification is tapped. */
  url?: string
  /** Notifications with the same tag replace each other. */
  tag?: string
}

/**
 * Sends to every device the member has registered. Dead subscriptions
 * (404/410 from the push service) are deleted. Returns how many succeeded.
 */
export async function sendToMember(db: SupabaseClient, memberId: string, msg: PushMessage) {
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('member_id', memberId)
  if (error) throw error

  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        { TTL: 60 * 60 * 12, urgency: 'normal' },
      )
      sent++
      await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), last_error: null }).eq('id', s.id)
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        await db.from('push_subscriptions').update({ last_error: String((e as Error).message ?? e).slice(0, 500) }).eq('id', s.id)
      }
    }
  }
  return { sent, devices: subs?.length ?? 0 }
}
