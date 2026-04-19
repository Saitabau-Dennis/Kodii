import { env } from '$env/dynamic/private'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { sendReminders } from '$lib/services/invoices'

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendReminders()
    return json({ success: true, ...result })
  } catch (error) {
    console.error('Error sending reminders:', error)
    return json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
