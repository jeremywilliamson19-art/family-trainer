// Sends a test notification to all of the caller's devices.
import { adminClient, json, requireUser, serve } from '../_shared/http.ts'
import { sendToMember } from '../_shared/push.ts'

serve(async (req) => {
  const user = await requireUser(req)
  const result = await sendToMember(adminClient(), user.id, {
    title: 'Family Trainer',
    body: 'Notifications are working. 💪',
    url: '/settings',
    tag: 'test',
  })
  return json(result)
})
