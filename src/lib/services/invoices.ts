import { and, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  payments,
  properties,
  rentInvoices,
  tenants,
  units,
  users,
} from '$lib/db/schema'
import { db } from '$lib/server/db'
import { sendSMS } from '$lib/server/sms'
import { getSettings } from '$lib/services/settings'
import { sendRentDueReminderSMS, sendRentOverdueReminderSMS } from '$lib/server/notifications'

function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0
  return Number(value)
}

async function getScopedPropertyIds(userId: string): Promise<string[]> {
  const [sessionUser] = await withRetry(() =>
    db
      .select({ role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )

  if (!sessionUser) return []

  if (sessionUser.role === 'landlord') {
    const rows = await withRetry(() =>
      db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.ownerId, userId)),
    )
    return rows.map((row) => row.id)
  }

  const rows = await withRetry(() =>
    db
      .select({ id: caretakerProperties.propertyId })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(
        and(eq(caretakerProperties.caretakerId, userId), eq(properties.ownerId, sessionUser.invitedBy ?? '')),
      ),
  )

  return rows.map((row) => row.id)
}

/**
 * Returns current month invoice/payment stats.
 */
export async function getCurrentMonthInvoiceStats(userId: string): Promise<{
  expectedRent: number
  overdueCount: number
  pendingCount: number
}> {
  const propertyIds = await getScopedPropertyIds(userId)
  if (propertyIds.length === 0) {
    return { expectedRent: 0, overdueCount: 0, pendingCount: 0 }
  }

  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const startDate = start.toISOString().slice(0, 10)
  const nextDate = next.toISOString().slice(0, 10)

  // Get current month expected rent
  const [invoiceTotals] = await withRetry(() =>
    db
      .select({
        expectedRent: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
      })
      .from(rentInvoices)
      .innerJoin(units, eq(rentInvoices.unitId, units.id))
      .where(
        and(
          inArray(units.propertyId, propertyIds),
          sql`${rentInvoices.dueDate} >= ${startDate}::date`,
          sql`${rentInvoices.dueDate} < ${nextDate}::date`,
        ),
      ),
  )

  // Get overdue tenants count (Active tenants with any past-due balance)
  const [overdue] = await withRetry(() =>
    db
      .select({
        count: sql<number>`count(distinct ${rentInvoices.tenantId})::int`,
      })
      .from(rentInvoices)
      .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
      .innerJoin(units, eq(rentInvoices.unitId, units.id))
      .where(
        and(
          inArray(units.propertyId, propertyIds),
          eq(tenants.status, 'active'),
          or(
            eq(rentInvoices.status, 'overdue'),
            and(
              inArray(rentInvoices.status, ['unpaid', 'partial']),
              sql`${rentInvoices.dueDate} < CURRENT_DATE`,
            ),
          ),
        ),
      ),
  )

  const [pending] = await withRetry(() =>
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(units, eq(payments.unitId, units.id))
      .where(and(inArray(units.propertyId, propertyIds), eq(payments.status, 'pending_verification'))),
  )

  return {
    expectedRent: toNumber(invoiceTotals?.expectedRent),
    overdueCount: overdue?.count ?? 0,
    pendingCount: pending?.count ?? 0,
  }
}

export async function getMonthlyOverdueCounts(userId: string, months = 6): Promise<number[]> {
  const propertyIds = await getScopedPropertyIds(userId)
  if (propertyIds.length === 0) return Array(months).fill(0)

  const endMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - (months - 1), 1)
  const nextMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1)

  const rows = await withRetry(() =>
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${rentInvoices.dueDate}::timestamp), 'YYYY-MM')`,
        count: sql<number>`count(distinct ${rentInvoices.tenantId})::int`,
      })
      .from(rentInvoices)
      .innerJoin(units, eq(rentInvoices.unitId, units.id))
      .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
      .where(
        and(
          inArray(units.propertyId, propertyIds),
          eq(tenants.status, 'active'),
          or(
            eq(rentInvoices.status, 'overdue'),
            and(
              inArray(rentInvoices.status, ['unpaid', 'partial']),
              sql`${rentInvoices.dueDate} < CURRENT_DATE`,
            ),
          ),
          sql`${rentInvoices.dueDate} >= ${startMonth.toISOString().slice(0, 10)}::date`,
          sql`${rentInvoices.dueDate} < ${nextMonth.toISOString().slice(0, 10)}::date`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${rentInvoices.dueDate}::timestamp)`),
  )

  const counts = new Map(rows.map((row) => [row.month, row.count]))

  return Array.from({ length: months }, (_, index) => {
    const month = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1)
    return counts.get(month.toISOString().slice(0, 7)) ?? 0
  })
}

/**
 * Sends a professional SMS invoice to a tenant for a specific invoice.
 */
export async function sendRentInvoiceSMS(invoiceId: string) {
  const [row] = await withRetry(() =>
    db
      .select({
        invoice: rentInvoices,
        tenant: tenants,
        property: properties,
        unit: units,
      })
      .from(rentInvoices)
      .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
      .innerJoin(properties, eq(tenants.propertyId, properties.id))
      .innerJoin(units, eq(rentInvoices.unitId, units.id))
      .where(eq(rentInvoices.id, invoiceId))
      .limit(1),
  )

  if (!row) throw new Error('Invoice not found')

  const { invoice, tenant, property, unit } = row
  const ownerSettings = await getSettings(property.ownerId)

  const monthName = new Date(invoice.dueDate).toLocaleDateString('en-KE', { month: 'long' })
  const formattedAmount = Number(invoice.amount).toLocaleString('en-KE')
  const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  let paymentInfo = ''
  if (ownerSettings?.collectionType === 'paybill') {
    const paybillNumber = ownerSettings.paybillNumber ?? ownerSettings.collectionAccount
    paymentInfo = `Pay via M-Pesa Paybill ${paybillNumber ?? '-'}`
    const paybillName = ownerSettings.paybillName ?? ownerSettings.accountName
    if (paybillName) {
      paymentInfo += ` (Account: ${paybillName})`
    }
    const paybillAccountNumber = ownerSettings.accountNumber ?? ownerSettings.referenceRule
    if (paybillAccountNumber) {
      paymentInfo += `. Account Number: ${paybillAccountNumber}`
    }
  } else if (ownerSettings?.collectionType === 'till') {
    const tillNumber = ownerSettings.tillNumber ?? ownerSettings.collectionAccount
    paymentInfo = `Pay via M-Pesa Till ${tillNumber ?? '-'}`
  }

  const message =
    `Your rent invoice for ${monthName} at ${property.name}, Unit ${unit.unitNumber} is KES ${formattedAmount}. ` +
    `Due date: ${dueDate}. ${paymentInfo} Thank you.`

  return sendSMS({
    to: tenant.phoneNumber,
    message,
  })
}

/**
 * Returns most recent unpaid or partial invoice.
 */
export async function getActiveInvoice(tenantId: string, unitId: string) {
  const [invoice] = await withRetry(() =>
    db
      .select()
      .from(rentInvoices)
      .where(
        and(
          eq(rentInvoices.tenantId, tenantId),
          eq(rentInvoices.unitId, unitId),
          or(eq(rentInvoices.status, 'unpaid'), eq(rentInvoices.status, 'partial'), eq(rentInvoices.status, 'overdue')),
        ),
      )
      .orderBy(desc(rentInvoices.dueDate))
      .limit(1),
  )

  return invoice || null
}

/**
 * Applies tenant credit balance to oldest outstanding invoices.
 * This is best-effort and keeps credit as a separate wallet-style balance.
 */
export async function applyTenantCreditToOutstandingInvoices(tenantId: string): Promise<{
  applied: number
  remainingCredit: number
  clearedInvoices: string[]
}> {
  const [tenant] = await withRetry(() =>
    db
      .select({ creditBalance: tenants.creditBalance })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  )

  const currentCredit = toNumber(tenant?.creditBalance)
  if (currentCredit <= 0) {
    return { applied: 0, remainingCredit: 0, clearedInvoices: [] }
  }

  const outstandingInvoices = await withRetry(() =>
    db
      .select({ id: rentInvoices.id, amount: rentInvoices.amount })
      .from(rentInvoices)
      .where(
        and(
          eq(rentInvoices.tenantId, tenantId),
          inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue']),
        ),
      )
      .orderBy(rentInvoices.dueDate),
  )

  if (outstandingInvoices.length === 0) {
    return { applied: 0, remainingCredit: currentCredit, clearedInvoices: [] }
  }

  let remainingCredit = currentCredit
  let applied = 0
  const clearedInvoices: string[] = []

  for (const invoice of outstandingInvoices) {
    if (remainingCredit <= 0) break

    const outstandingAmount = toNumber(invoice.amount)
    if (outstandingAmount <= 0) continue

    if (remainingCredit >= outstandingAmount) {
      remainingCredit -= outstandingAmount
      applied += outstandingAmount
      clearedInvoices.push(invoice.id)
      continue
    }

    const remainingOutstanding = outstandingAmount - remainingCredit
    applied += remainingCredit

    await withRetry(() =>
      db
        .update(rentInvoices)
        .set({
          amount: remainingOutstanding.toString(),
          status: 'partial',
        })
        .where(eq(rentInvoices.id, invoice.id)),
    )

    remainingCredit = 0
    break
  }

  if (clearedInvoices.length > 0) {
    await withRetry(() =>
      db
        .update(rentInvoices)
        .set({ status: 'paid' })
        .where(inArray(rentInvoices.id, clearedInvoices)),
    )
  }

  if (applied > 0) {
    await withRetry(() =>
      db
        .update(tenants)
        .set({ creditBalance: remainingCredit.toString() })
        .where(eq(tenants.id, tenantId)),
    )
  }

  return { applied, remainingCredit, clearedInvoices }
}

/**
 * Creates invoices for all active tenants who don't have one for current month.
 */
export async function generateMonthlyInvoices() {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // Find all active tenants
  const activeTenants = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        unitId: tenants.unitId,
        rentDueDay: tenants.rentDueDay,
        monthlyRent: units.monthlyRent,
      })
      .from(tenants)
      .innerJoin(units, eq(tenants.unitId, units.id))
      .where(eq(tenants.status, 'active')),
  )

  let generatedCount = 0

  for (const tenant of activeTenants) {
    if (!tenant.unitId) continue

    // Check if invoice already exists for this month
    const [existing] = await withRetry(() =>
      db
        .select({ id: rentInvoices.id })
        .from(rentInvoices)
        .where(
          and(
            eq(rentInvoices.tenantId, tenant.id),
            eq(rentInvoices.unitId, tenant.unitId!),
            gte(rentInvoices.dueDate, currentMonthStart.toISOString().slice(0, 10)),
            lt(rentInvoices.dueDate, new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)),
          ),
        )
        .limit(1),
    )

    if (existing) continue

    // Create invoice
    const dueDate = new Date(now.getFullYear(), now.getMonth(), tenant.rentDueDay)
    // If due day is e.g. 31 and month has 30 days, Date constructor handles it or we cap it
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    if (tenant.rentDueDay > lastDayOfMonth) {
      dueDate.setDate(lastDayOfMonth)
    }

    await withRetry(() =>
      db.insert(rentInvoices).values({
        tenantId: tenant.id,
        unitId: tenant.unitId!,
        amount: tenant.monthlyRent,
        dueDate: dueDate.toISOString().slice(0, 10),
        status: 'unpaid',
      }),
    )

    generatedCount++
  }

  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: null,
      action: 'invoices_generated',
      entityType: 'cron',
      metadata: { count: generatedCount },
    }),
  )

  return generatedCount
}

/**
 * Updates invoice status based on payment.
 */
export async function updateInvoiceAfterPayment(invoiceId: string, amountReceived: number) {
  const [invoice] = await withRetry(() =>
    db.select().from(rentInvoices).where(eq(rentInvoices.id, invoiceId)).limit(1),
  )

  if (!invoice) throw new Error('Invoice not found')

  // Calculate total confirmed payments for this invoice
  const confirmedPayments = await withRetry(() =>
    db
      .select({
        total: sql<string>`coalesce(sum(${payments.amountReceived}), 0)::text`,
      })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), inArray(payments.status, ['paid', 'partial']))),
  )

  const totalPaid = Number(confirmedPayments[0].total)
  const amountExpected = Number(invoice.amount)
  const outstanding = Math.max(0, amountExpected - totalPaid)
  const excess = Math.max(0, totalPaid - amountExpected)

  const newStatus = outstanding <= 0 ? 'paid' : 'partial'

  await withRetry(() =>
    db.update(rentInvoices).set({ status: newStatus }).where(eq(rentInvoices.id, invoiceId)),
  )

  return { outstanding, excess, status: newStatus }
}

/**
 * Sets status = overdue for all unpaid/partial invoices past their due_date.
 */
export async function markOverdueInvoices() {
  const today = new Date().toISOString().slice(0, 10)

  const result = await withRetry(() =>
    db
      .update(rentInvoices)
      .set({ status: 'overdue' })
      .where(and(lt(rentInvoices.dueDate, today), inArray(rentInvoices.status, ['unpaid', 'partial'])))
      .returning({ id: rentInvoices.id }),
  )

  return result.length
}

/**
 * Sends reminders for due and overdue invoices.
 */
export async function sendReminders() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  function daysPastDue(dueDate: string): number {
    const due = new Date(`${dueDate}T00:00:00.000Z`)
    const now = new Date(`${todayStr}T00:00:00.000Z`)
    return Math.floor((now.getTime() - due.getTime()) / 86_400_000)
  }

  // Find all landlords to get their settings
  const landlords = await withRetry(() => db.select({ id: users.id }).from(users).where(eq(users.role, 'landlord')))

  let dueCount = 0
  let overdueCount = 0

  for (const landlord of landlords) {
    const settings = await getSettings(landlord.id)
    const reminderDaysBefore = settings?.reminderDaysBefore ?? 3
    const enableRentReminders = settings?.enableRentReminders ?? true
    const remindOnDueDay = settings?.remindOnDueDay ?? true
    const enableOverdueReminders = settings?.enableOverdueReminders ?? true
    const overdueReminderFrequency = Math.max(1, settings?.overdueReminderFrequency ?? 7)
    const overdueMaxReminders = Math.max(1, settings?.overdueMaxReminders ?? 3)

    const reminderDate = new Date()
    reminderDate.setDate(reminderDate.getDate() + reminderDaysBefore)
    const reminderDateStr = reminderDate.toISOString().slice(0, 10)

    // 1. Due soon reminders
    if (enableRentReminders) {
      const dueSoonInvoices = await withRetry(() =>
        db
          .select({
            invoice: rentInvoices,
            tenant: tenants,
            unit: units,
          })
          .from(rentInvoices)
          .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
          .innerJoin(units, eq(rentInvoices.unitId, units.id))
          .innerJoin(properties, eq(units.propertyId, properties.id))
          .where(
            and(
              eq(properties.ownerId, landlord.id),
              eq(rentInvoices.dueDate, reminderDateStr),
              eq(rentInvoices.status, 'unpaid'),
            ),
          ),
      )

      for (const item of dueSoonInvoices) {
        await sendRentDueReminderSMS(
          { fullName: item.tenant.fullName, phoneNumber: item.tenant.phoneNumber },
          { unitNumber: item.unit.unitNumber },
          Number(item.invoice.amount),
          item.invoice.dueDate,
        )
        dueCount++
      }
    }

    // 1b. Due date reminders
    if (remindOnDueDay) {
      const dueTodayInvoices = await withRetry(() =>
        db
          .select({
            invoice: rentInvoices,
            tenant: tenants,
            unit: units,
          })
          .from(rentInvoices)
          .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
          .innerJoin(units, eq(rentInvoices.unitId, units.id))
          .innerJoin(properties, eq(units.propertyId, properties.id))
          .where(
            and(
              eq(properties.ownerId, landlord.id),
              eq(rentInvoices.dueDate, todayStr),
              inArray(rentInvoices.status, ['unpaid', 'partial']),
            ),
          ),
      )

      for (const item of dueTodayInvoices) {
        await sendRentDueReminderSMS(
          { fullName: item.tenant.fullName, phoneNumber: item.tenant.phoneNumber },
          { unitNumber: item.unit.unitNumber },
          Number(item.invoice.amount),
          item.invoice.dueDate,
        )
        dueCount++
      }
    }

    // 2. Overdue reminders
    if (enableOverdueReminders) {
      const overdueInvoices = await withRetry(() =>
        db
          .select({
            invoice: rentInvoices,
            tenant: tenants,
            unit: units,
          })
          .from(rentInvoices)
          .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
          .innerJoin(units, eq(rentInvoices.unitId, units.id))
          .innerJoin(properties, eq(units.propertyId, properties.id))
          .where(
            and(
              eq(properties.ownerId, landlord.id),
              lt(rentInvoices.dueDate, todayStr),
              inArray(rentInvoices.status, ['overdue', 'unpaid', 'partial']),
            ),
          ),
      )

      for (const item of overdueInvoices) {
        const overdueDays = daysPastDue(item.invoice.dueDate)
        if (overdueDays <= 0) continue
        if (overdueDays % overdueReminderFrequency !== 0) continue
        if (overdueDays / overdueReminderFrequency > overdueMaxReminders) continue

        await sendRentOverdueReminderSMS(
          { fullName: item.tenant.fullName, phoneNumber: item.tenant.phoneNumber },
          { unitNumber: item.unit.unitNumber },
          Number(item.invoice.amount),
          item.invoice.dueDate,
        )
        overdueCount++
      }
    }
  }

  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: null,
      action: 'reminders_sent',
      entityType: 'cron',
      metadata: { dueCount, overdueCount },
    }),
  )

  return { dueCount, overdueCount }
}
