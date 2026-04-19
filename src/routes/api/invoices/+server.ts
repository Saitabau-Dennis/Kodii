import { env } from '$env/dynamic/private'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { generateMonthlyInvoices, markOverdueInvoices } from '$lib/services/invoices'

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const generated = await generateMonthlyInvoices()
    const overdue = await markOverdueInvoices()

    return json({ success: true, generated, overdue })
  } catch (error) {
    console.error('Error in invoice cron:', error)
    return json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
