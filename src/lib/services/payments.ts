import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  payments,
  properties,
  rentInvoices,
  settings,
  tenants,
  units,
  users,
} from '$lib/db/schema'
import { db } from '$lib/server/db'
import { normalizePhone } from '$lib/server/auth'
import {
  sendPaymentConfirmedSMS,
  sendPaymentPartialSMS,
  sendPaymentRejectedSMS,
} from '$lib/server/notifications'
import {
  applyTenantCreditToOutstandingInvoices,
  getActiveInvoice,
  updateInvoiceAfterPayment,
} from './invoices'
import type { PaymentWithDetails } from '$lib/types/payments'

type PaymentFilters = {
  status?: string | null
  propertyId?: string | null
  unitId?: string | null
  tenantId?: string | null
  search?: string | null
}

function paymentSelect() {
  return {
    id: payments.id,
    tenantId: payments.tenantId,
    tenantName: tenants.fullName,
    tenantPhone: tenants.phoneNumber,
    unitId: payments.unitId,
    unitNumber: units.unitNumber,
    propertyId: units.propertyId,
    propertyName: properties.name,
    invoiceId: payments.invoiceId,
    amountExpected: sql<number>`${payments.amountExpected}::float`,
    amountReceived: sql<number | null>`${payments.amountReceived}::float`,
    unitMonthlyRent: sql<number>`${units.monthlyRent}::float`,
    tenantCreditBalance: sql<number>`${tenants.creditBalance}::float`,
    mpesaCode: payments.mpesaCode,
    payerPhone: payments.payerPhone,
    paymentReference: payments.paymentReference,
    status: payments.status,
    submittedAt: payments.submittedAt,
    verifiedAt: payments.verifiedAt,
    verifiedBy: payments.verifiedBy,
    verifiedByName: users.name,
    notes: payments.notes,
  }
}

export async function getPaymentsByLandlord(
  landlordId: string,
  page = 1,
  limit = 10,
  filters: PaymentFilters = {},
): Promise<{ payments: PaymentWithDetails[]; totalCount: number }> {
  const offset = (page - 1) * limit

  // Get properties the user has access to
  const [sessionUser] = await withRetry(() =>
    db.select({ role: users.role, invitedBy: users.invitedBy }).from(users).where(eq(users.id, landlordId)).limit(1),
  )

  if (!sessionUser) return { payments: [], totalCount: 0 }

  let propertyIds: string[] = []
  if (sessionUser.role === 'landlord') {
    const rows = await withRetry(() =>
      db.select({ id: properties.id }).from(properties).where(eq(properties.ownerId, landlordId)),
    )
    propertyIds = rows.map((r) => r.id)
  } else {
    const rows = await withRetry(() =>
      db
        .select({ id: caretakerProperties.propertyId })
        .from(caretakerProperties)
        .where(eq(caretakerProperties.caretakerId, landlordId)),
    )
    propertyIds = rows.map((r) => r.id)
  }

  if (propertyIds.length === 0) return { payments: [], totalCount: 0 }

  const clauses = [inArray(units.propertyId, propertyIds)]

  if (filters.status && filters.status !== 'all') {
    clauses.push(eq(payments.status, filters.status as any))
  }
  if (filters.propertyId) {
    clauses.push(eq(units.propertyId, filters.propertyId))
  }
  if (filters.unitId) {
    clauses.push(eq(payments.unitId, filters.unitId))
  }
  if (filters.tenantId) {
    clauses.push(eq(payments.tenantId, filters.tenantId))
  }
  if (filters.search) {
    const term = `%${filters.search}%`
    clauses.push(
      or(
        ilike(tenants.fullName, term),
        ilike(units.unitNumber, term),
        ilike(tenants.phoneNumber, term),
        ilike(payments.mpesaCode, term),
      )!,
    )
  }

  const whereClause = and(...clauses)

  const rows = await withRetry(() =>
    db
      .select(paymentSelect())
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(users, eq(payments.verifiedBy, users.id))
      .where(whereClause)
      .orderBy(desc(payments.submittedAt))
      .limit(limit)
      .offset(offset),
  )

  const [{ count }] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .where(whereClause),
  )

  return {
    payments: rows as PaymentWithDetails[],
    totalCount: count,
  }
}

export async function getPendingPayments(landlordId: string): Promise<PaymentWithDetails[]> {
  const [sessionUser] = await withRetry(() =>
    db.select({ role: users.role }).from(users).where(eq(users.id, landlordId)).limit(1),
  )
  if (!sessionUser || sessionUser.role !== 'landlord') return []

  const propertyRows = await withRetry(() =>
    db.select({ id: properties.id }).from(properties).where(eq(properties.ownerId, landlordId)),
  )
  const propertyIds = propertyRows.map((r) => r.id)
  if (propertyIds.length === 0) return []

  const rows = await withRetry(() =>
    db
      .select(paymentSelect())
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(users, eq(payments.verifiedBy, users.id))
      .where(and(inArray(units.propertyId, propertyIds), eq(payments.status, 'pending_verification')))
      .orderBy(desc(payments.submittedAt)),
  )

  return rows as PaymentWithDetails[]
}

export async function getPaymentById(id: string): Promise<PaymentWithDetails | null> {
  const [row] = await withRetry(() =>
    db
      .select(paymentSelect())
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(users, eq(payments.verifiedBy, users.id))
      .where(eq(payments.id, id))
      .limit(1),
  )

  return (row as PaymentWithDetails) || null
}

async function shouldNotifyPaymentConfirmed(ownerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ enabled: settings.notifyPaymentConfirmed })
      .from(settings)
      .where(eq(settings.userId, ownerId))
      .limit(1),
  )
  return row?.enabled ?? true
}

async function shouldNotifyPaymentRejected(ownerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ enabled: settings.notifyPaymentRejected })
      .from(settings)
      .where(eq(settings.userId, ownerId))
      .limit(1),
  )
  return row?.enabled ?? true
}

export async function confirmPayment(id: string, amountReceived: number, verifiedBy: string) {
  const payment = await getPaymentById(id)
  if (!payment) throw new Error('Payment not found')

  const status = amountReceived >= payment.amountExpected ? 'paid' : 'partial'

  await withRetry(() =>
    db
      .update(payments)
      .set({
        amountReceived: amountReceived.toString(),
        status,
        verifiedAt: new Date(),
        verifiedBy,
      })
      .where(eq(payments.id, id)),
  )

  let outstanding = 0
  let excessCredit = 0
  if (payment.invoiceId) {
    const result = await updateInvoiceAfterPayment(payment.invoiceId, amountReceived)
    outstanding = result.outstanding
    excessCredit = result.excess
  }

  let creditApplied = 0
  let creditRemaining = 0
  if (excessCredit > 0) {
    await withRetry(() =>
      db
        .update(tenants)
        .set({
          creditBalance: sql<string>`(${tenants.creditBalance} + ${excessCredit})::text`,
        })
        .where(eq(tenants.id, payment.tenantId)),
    )

    const creditResult = await applyTenantCreditToOutstandingInvoices(payment.tenantId)
    creditApplied = creditResult.applied
    creditRemaining = creditResult.remainingCredit
  }

  const tenant = { fullName: payment.tenantName, phoneNumber: payment.tenantPhone }
  const unit = { unitNumber: payment.unitNumber }
  const [owner] = await withRetry(() =>
    db
      .select({ ownerId: properties.ownerId })
      .from(properties)
      .innerJoin(units, eq(units.propertyId, properties.id))
      .where(eq(units.id, payment.unitId))
      .limit(1),
  )
  const notifyConfirmed = owner ? await shouldNotifyPaymentConfirmed(owner.ownerId) : true

  if (notifyConfirmed) {
    if (status === 'paid') {
      await sendPaymentConfirmedSMS(tenant, unit, amountReceived, payment.mpesaCode || '')
    } else {
      // For partial, we need a due date. Let's try to get it from the invoice or default to end of month.
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7) // Default to 7 days from now if not found
      await sendPaymentPartialSMS(tenant, unit, amountReceived, outstanding, dueDate.toLocaleDateString('en-KE'))
    }
  }

  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: verifiedBy,
      action: 'payment_confirmed',
      entityType: 'payment',
      entityId: id,
      metadata: {
        amountReceived,
        status,
        overpaymentCredit: excessCredit,
        creditApplied,
        creditRemaining,
      },
    }),
  )
}

export async function rejectPayment(id: string, reason: string, verifiedBy: string) {
  const payment = await getPaymentById(id)
  if (!payment) throw new Error('Payment not found')

  await withRetry(() =>
    db
      .update(payments)
      .set({
        status: 'rejected',
        notes: reason,
        verifiedAt: new Date(),
        verifiedBy,
      })
      .where(eq(payments.id, id)),
  )

  const [owner] = await withRetry(() =>
    db
      .select({ ownerId: properties.ownerId })
      .from(properties)
      .innerJoin(units, eq(units.propertyId, properties.id))
      .where(eq(units.id, payment.unitId))
      .limit(1),
  )
  const notifyRejected = owner ? await shouldNotifyPaymentRejected(owner.ownerId) : true

  if (notifyRejected) {
    await sendPaymentRejectedSMS(
      { fullName: payment.tenantName, phoneNumber: payment.tenantPhone },
      { unitNumber: payment.unitNumber },
      payment.amountReceived || 0,
      payment.mpesaCode || '',
      reason,
    )
  }

  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: verifiedBy,
      action: 'payment_rejected',
      entityType: 'payment',
      entityId: id,
      metadata: { reason },
    }),
  )
}

export async function handleSMSPayment(
  fromPhone: string,
  unitNumber: string,
  amount: number,
  mpesaCode: string,
): Promise<{ success: boolean; message: string }> {
  const normalizedPhone = normalizePhone(fromPhone)

  // 1. Find unit
  const [unit] = await withRetry(() =>
    db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        unitNumber: units.unitNumber,
        monthlyRent: units.monthlyRent,
        paymentReference: units.paymentReference,
        status: units.status,
      })
      .from(units)
      .where(ilike(units.unitNumber, unitNumber.trim()))
      .limit(1),
  )

  if (!unit) {
    return {
      success: false,
      message: `Unit ${unitNumber} not found. Please check the unit number and try again.`,
    }
  }

  // 2. Find tenant
  const [tenant] = await withRetry(() =>
    db
      .select({ id: tenants.id, fullName: tenants.fullName })
      .from(tenants)
      .where(eq(tenants.phoneNumber, normalizedPhone))
      .limit(1),
  )

  if (!tenant) {
    return {
      success: false,
      message: 'Your phone number is not registered. Please contact your landlord.',
    }
  }

  // 3. Check for duplicate M-Pesa code
  const [duplicate] = await withRetry(() =>
    db.select({ id: payments.id }).from(payments).where(eq(payments.mpesaCode, mpesaCode.trim())).limit(1),
  )

  if (duplicate) {
    return {
      success: false,
      message: 'This M-Pesa code has already been submitted. Contact your landlord if you think this is an error.',
    }
  }

  // 4. Find active invoice
  const invoice = await getActiveInvoice(tenant.id, unit.id)

  // 5. Create payment record
  const amountExpected = invoice ? Number(invoice.amount) : Number(unit.monthlyRent)

  const [created] = await withRetry(() =>
    db
      .insert(payments)
      .values({
        tenantId: tenant.id,
        unitId: unit.id,
        invoiceId: invoice?.id ?? null,
        amountExpected: amountExpected.toString(),
        amountReceived: amount.toString(),
        mpesaCode: mpesaCode.trim().toUpperCase(),
        payerPhone: normalizedPhone,
        paymentReference: unit.paymentReference,
        status: 'pending_verification',
        submittedAt: new Date(),
      })
      .returning({ id: payments.id }),
  )

  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: null,
      action: 'payment_submitted',
      entityType: 'payment',
      entityId: created.id,
      metadata: { mpesaCode, amount, fromPhone },
    }),
  )

  return {
    success: true,
    message: `Your payment of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} has been received and is pending confirmation. M-Pesa code: ${mpesaCode.toUpperCase()}. We will notify you once it is confirmed.`,
  }
}

/**
 * Dashboard helper: Returns recent payments for landlord/caretaker properties.
 */
export async function getRecentPayments(userId: string, limit = 5): Promise<PaymentWithDetails[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const rows = await withRetry(() =>
    db
      .select(paymentSelect())
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(users, eq(payments.verifiedBy, users.id))
      .where(inArray(units.propertyId, propertyIds))
      .orderBy(desc(payments.submittedAt))
      .limit(limit),
  )

  return rows as PaymentWithDetails[]
}

/**
 * Dashboard helper: Returns recent payments in a simplified format for the dashboard table.
 */
export async function getRecentPaymentsForDashboard(
  userId: string,
  limit = 5,
): Promise<Array<{ id: string; tenantName: string; unitNumber: string; amount: number; status: any; date: string }>> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const rows = await withRetry(() =>
    db
      .select({
        id: payments.id,
        tenantName: tenants.fullName,
        unitNumber: units.unitNumber,
        amount: sql<number>`coalesce(${payments.amountReceived}, ${payments.amountExpected})::float`,
        status: payments.status,
        date: payments.submittedAt,
      })
      .from(payments)
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .innerJoin(units, eq(payments.unitId, units.id))
      .where(inArray(units.propertyId, propertyIds))
      .orderBy(desc(payments.submittedAt))
      .limit(limit),
  )

  return rows.map((r) => ({
    id: r.id,
    tenantName: r.tenantName,
    unitNumber: r.unitNumber,
    amount: r.amount,
    status: r.status,
    date: r.date?.toISOString() ?? new Date().toISOString(),
  }))
}

/**
 * Dashboard helper: Returns current month confirmed rent.
 */
export async function getCurrentMonthPaymentStats(userId: string): Promise<{
  confirmedRent: number
}> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return { confirmedRent: 0 }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startOfMonthDate = startOfMonth.toISOString().slice(0, 10)

  const [row] = await withRetry(() =>
    db
      .select({
        confirmedRent: sql<string>`coalesce(sum(${payments.amountReceived}), 0)::text`,
      })
      .from(payments)
      .innerJoin(units, eq(payments.unitId, units.id))
      .where(
        and(
          inArray(units.propertyId, propertyIds),
          eq(payments.status, 'paid'),
          sql`${payments.verifiedAt} >= ${startOfMonthDate}::date`,
        ),
      ),
  )

  return {
    confirmedRent: Number(row?.confirmedRent ?? 0),
  }
}

/**
 * Dashboard helper: Returns last 6-month payment totals.
 */
export async function getMonthlyPaymentTotals(
  userId: string,
  months = 6,
): Promise<Array<{ month: string; expectedRent: number; confirmedRent: number; outstanding: number }>> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const now = new Date()
  const monthStarts = Array.from({ length: months }, (_, i) => {
    const shift = months - 1 - i
    return new Date(now.getFullYear(), now.getMonth() - shift, 1)
  })

  // Grouped by month
  const results: Array<{ month: string; expectedRent: number; confirmedRent: number; outstanding: number }> = []

  for (const monthStart of monthStarts) {
    const monthStr = monthStart.toISOString().slice(0, 7) // YYYY-MM
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    
    const startStr = monthStart.toISOString().slice(0, 10)
    const nextStr = nextMonth.toISOString().slice(0, 10)

    const [totals] = await withRetry(() =>
      db
        .select({
          expected: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
          confirmed: sql<string>`coalesce(sum(${payments.amountReceived}) filter (where ${payments.status} in ('paid', 'partial')), 0)::text`,
        })
        .from(rentInvoices)
        .leftJoin(payments, eq(payments.invoiceId, rentInvoices.id))
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            sql`${rentInvoices.dueDate} >= ${startStr}::date`,
            sql`${rentInvoices.dueDate} < ${nextStr}::date`,
          ),
        ),
    )

    const expected = Number(totals?.expected ?? 0)
    const confirmed = Number(totals?.confirmed ?? 0)
    results.push({
      month: monthStr,
      expectedRent: expected,
      confirmedRent: confirmed,
      outstanding: Math.max(expected - confirmed, 0),
    })
  }

  return results
}

/**
 * Dashboard helper: Returns last 6-month pending verification counts.
 */
export async function getMonthlyPendingCounts(userId: string, months = 6): Promise<number[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return Array(months).fill(0)

  const now = new Date()
  const monthStarts = Array.from({ length: months }, (_, i) => {
    const shift = months - 1 - i
    return new Date(now.getFullYear(), now.getMonth() - shift, 1)
  })

  const results: number[] = []

  for (const monthStart of monthStarts) {
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    const startStr = monthStart.toISOString().slice(0, 10)
    const nextStr = nextMonth.toISOString().slice(0, 10)

    const [count] = await withRetry(() =>
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            eq(payments.status, 'pending_verification'),
            sql`${payments.submittedAt} >= ${startStr}::date`,
            sql`${payments.submittedAt} < ${nextStr}::date`,
          ),
        ),
    )

    results.push(count?.count ?? 0)
  }

  return results
}

async function getAccessiblePropertyIds(userId: string): Promise<string[]> {
  const [sessionUser] = await withRetry(() =>
    db.select({ role: users.role, invitedBy: users.invitedBy }).from(users).where(eq(users.id, userId)).limit(1),
  )

  if (!sessionUser) return []

  if (sessionUser.role === 'landlord') {
    const rows = await withRetry(() =>
      db.select({ id: properties.id }).from(properties).where(eq(properties.ownerId, userId)),
    )
    return rows.map((row) => row.id)
  }

  const rows = await withRetry(() =>
    db
      .select({ id: caretakerProperties.propertyId })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(and(eq(caretakerProperties.caretakerId, userId), eq(properties.ownerId, sessionUser.invitedBy ?? ''))),
  )
  return rows.map((row) => row.id)
}
