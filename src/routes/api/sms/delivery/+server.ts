import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '$lib/db'
import { withRetry } from '$lib/db/retry'
import { activityLogs, notices } from '$lib/db/schema'

export async function POST({ request }: { request: Request }) {
  try {
    const formData = await request.formData()

    const id = formData.get('id') as string
    const status = formData.get('status') as string
    const phoneNumber = formData.get('phoneNumber') as string
    const failureReason = formData.get('failureReason') as string

    console.log('[KODII] SMS delivery report:', {
      id,
      status,
      phoneNumber,
      failureReason,
    })

    if (status) {
      const normalizedStatus = status.toLowerCase()
      const mappedStatus =
        normalizedStatus === 'success'
          ? 'delivered'
          : normalizedStatus === 'failed' || normalizedStatus === 'rejected'
            ? 'failed'
            : 'sent'

      let noticeId: string | null = null

      // 1) Exact match by provider message id
      if (id) {
        const [logByProviderId] = await withRetry(() =>
          db
            .select({ entityId: activityLogs.entityId })
            .from(activityLogs)
            .where(
              and(
                eq(activityLogs.action, 'notice_sms_sent'),
                sql`${activityLogs.metadata}->>'providerMessageId' = ${id}`,
              ),
            )
            .orderBy(desc(activityLogs.createdAt))
            .limit(1),
        )
        noticeId = logByProviderId?.entityId ?? null
      }

      // 2) Fallback by recipient phone for recent sends
      if (!noticeId && phoneNumber) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const [logByPhone] = await withRetry(() =>
          db
            .select({ entityId: activityLogs.entityId })
            .from(activityLogs)
            .where(
              and(
                eq(activityLogs.action, 'notice_sms_sent'),
                gte(activityLogs.createdAt, since),
                sql`${activityLogs.metadata}->>'to' = ${phoneNumber}`,
              ),
            )
            .orderBy(desc(activityLogs.createdAt))
            .limit(1),
        )
        noticeId = logByPhone?.entityId ?? null
      }

      if (noticeId) {
        const [notice] = await withRetry(() =>
          db
            .select({ id: notices.id, deliveryStatus: notices.deliveryStatus })
            .from(notices)
            .where(eq(notices.id, noticeId))
            .limit(1),
        )

        // Keep delivered as strongest status once reached.
        const nextStatus = notice?.deliveryStatus === 'delivered' ? 'delivered' : mappedStatus

        await withRetry(() =>
          db
            .update(notices)
            .set({ deliveryStatus: nextStatus })
            .where(eq(notices.id, noticeId)),
        )
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[KODII] Delivery report error:', error)
    return new Response('OK', { status: 200 })
  }
}
