import { and, desc, eq, gte, or, sql } from 'drizzle-orm'
import type { RequestHandler } from './$types'
import { withRetry } from '$lib/db/retry'
import { activityLogs, notices, tenants } from '$lib/db/schema'
import { normalizePhone } from '$lib/server/auth'
import { sendSMSReportReplySMS } from '$lib/server/notifications'
import { db } from '$lib/server/db'
import { handleSMSReport } from '$lib/services/maintenance'
import { saveReply } from '$lib/services/notice-replies'

function makeDedupeKey(fromPhone: string, message: string, providerMessageId: string): string {
  if (providerMessageId) return `provider:${providerMessageId.trim()}`

  const normalized = `${fromPhone.trim().toLowerCase()}|${message.trim().toLowerCase()}`
  return `fallback:${Buffer.from(normalized).toString('hex')}`
}

async function isAlreadyProcessed(dedupeKey: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.action, 'sms_callback_processed'),
          sql`${activityLogs.metadata}->>'dedupeKey' = ${dedupeKey}`,
        ),
      )
      .limit(1),
  )

  return Boolean(row)
}

async function markProcessed(input: {
  dedupeKey: string
  fromPhone: string
  message: string
  providerMessageId: string | null
}) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: null,
      action: 'sms_callback_processed',
      entityType: 'sms_callback',
      metadata: {
        dedupeKey: input.dedupeKey,
        fromPhone: input.fromPhone,
        message: input.message,
        providerMessageId: input.providerMessageId,
      },
    }),
  )
}

async function handlePaySMS(fromPhone: string, text: string) {
  const parts = text.trim().split(/\s+/)
  const invalidFormatReply =
    'Invalid payment format.\nUse: PAY [unit] [amount] [mpesa_code]\nExample: PAY B3 12000 QJD7X8Y2Z'

  if (parts.length !== 4) {
    await sendSMSReportReplySMS(fromPhone, '', '', invalidFormatReply)
    return
  }

  const keyword = parts[0]?.trim().toUpperCase() ?? ''
  const unitNumber = parts[1]?.trim().toUpperCase() ?? ''
  const amountToken = parts[2]?.trim() ?? ''
  const mpesaCode = parts[3]?.trim().toUpperCase() ?? ''

  if (keyword !== 'PAY' || !unitNumber) {
    await sendSMSReportReplySMS(fromPhone, '', '', invalidFormatReply)
    return
  }

  const normalizedAmount = amountToken.replace(/,/g, '')
  const isValidAmount = /^\d+(\.\d{1,2})?$/.test(normalizedAmount)
  const amount = isValidAmount ? Number(normalizedAmount) : Number.NaN

  const isValidMpesaCode = /^[A-Z0-9]{10}$/.test(mpesaCode)
  if (Number.isNaN(amount) || amount <= 0 || !isValidMpesaCode) {
    const errorMsg =
      'Your payment details could not be validated.\nPlease send: PAY [unit] [amount] [mpesa_code]\nExample: PAY B3 12000 QJD7X8Y2Z'
    await sendSMSReportReplySMS(fromPhone, '', '', errorMsg)
    return
  }

  const { handleSMSPayment } = await import('$lib/services/payments')
  const result = await handleSMSPayment(fromPhone, unitNumber, amount, mpesaCode)
  if (!result.success) {
    await sendSMSReportReplySMS(fromPhone, unitNumber, '', result.message)
  }
}

async function handleReportSMS(fromPhone: string, text: string) {
  const parts = text.trim().split(/\s+/)
  const unitNumber = parts[1]?.trim() ?? ''
  const description = parts.slice(2).join(' ').trim()

  if (!unitNumber || !description) {
    await sendSMSReportReplySMS(
      fromPhone,
      '',
      '',
      'Your report details could not be read.\nPlease send: REPORT [unit_number] [description]\nExample: REPORT B3 pipe is leaking',
    )
    return
  }

  const result = await handleSMSReport(fromPhone, unitNumber, description)
  if (!result.success) {
    await sendSMSReportReplySMS(fromPhone, unitNumber, '', result.message)
  }
}

async function handleReply(fromPhone: string, text: string) {
  const [tenant] = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        propertyId: tenants.propertyId,
        unitId: tenants.unitId,
      })
      .from(tenants)
      .where(eq(tenants.phoneNumber, fromPhone))
      .limit(1),
  )

  let noticeId: string | null = null
  if (tenant) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const noticeTargets = [
      eq(notices.targetType, 'all_tenants'),
      and(eq(notices.targetType, 'property'), eq(notices.targetId, tenant.propertyId)),
      and(eq(notices.targetType, 'tenant'), eq(notices.targetId, tenant.id)),
    ]
    if (tenant.unitId) {
      noticeTargets.push(and(eq(notices.targetType, 'unit'), eq(notices.targetId, tenant.unitId)))
    }

    const [recentNotice] = await withRetry(() =>
      db
        .select({ id: notices.id })
        .from(notices)
        .where(
          and(
            gte(notices.sentAt, since),
            or(...noticeTargets),
          ),
        )
        .orderBy(desc(notices.sentAt))
        .limit(1),
    )
    noticeId = recentNotice?.id ?? null
  }

  await saveReply({
    noticeId,
    tenantId: tenant?.id ?? null,
    fromPhone,
    message: text.trim(),
  })
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData()

    const from = formData.get('from') as string
    const to = formData.get('to') as string
    const text = (formData.get('text') as string | null)?.trim() ?? ''
    const id = formData.get('id') as string
    const date = formData.get('date') as string
    const networkCode = formData.get('networkCode') as string

    if (!from || !text) {
      return new Response('Bad Request', { status: 400 })
    }

    const normalizedFrom = (() => {
      try {
        return normalizePhone(from)
      } catch {
        return from
      }
    })()

    const dedupeKey = makeDedupeKey(normalizedFrom, text, id ?? '')
    if (await isAlreadyProcessed(dedupeKey)) {
      return new Response('OK', { status: 200 })
    }

    const message = text.toUpperCase()

    if (message.startsWith('PAY')) {
      await handlePaySMS(normalizedFrom, text)
    } else if (message.startsWith('REPORT')) {
      await handleReportSMS(normalizedFrom, text)
    } else {
      await handleReply(normalizedFrom, text)
    }

    await markProcessed({
      dedupeKey,
      fromPhone: normalizedFrom,
      message: text,
      providerMessageId: id || null,
    })

    console.log('[KODII] Inbound SMS received:', { from, to, id, date, networkCode })

    // Always return 200 so AT does not retry
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[KODII] SMS webhook error:', error)
    // Still return 200 to prevent AT retrying
    return new Response('OK', { status: 200 })
  }
}
