import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import { caretakerProperties, maintenanceTickets, payments, properties, rentInvoices, tenants, units, users } from '$lib/db/schema'
import { db } from '$lib/server/db'
import type {
  FinancialSummary,
  MaintenanceByProperty,
  MaintenanceSummary,
  OccupancyByProperty,
  OccupancySummary,
  OverdueTenant,
  PendingPaymentReportItem,
  PendingPaymentsResult,
  RentByProperty,
} from '$lib/types/reports'
import { getPaymentsByLandlord } from '$lib/services/payments'

function asNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nextDay(date: Date): Date {
  const value = new Date(date)
  value.setDate(value.getDate() + 1)
  return value
}

async function getAccessiblePropertyIds(userId: string): Promise<string[]> {
  const [scope] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )
  if (!scope) return []

  if (scope.role === 'landlord') {
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
      .where(and(eq(caretakerProperties.caretakerId, userId), eq(properties.ownerId, scope.invitedBy ?? ''))),
  )
  return rows.map((row) => row.id)
}

export async function getFinancialSummary(userId: string, from: Date, to: Date): Promise<FinancialSummary> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) {
    return { expectedRent: 0, confirmedRent: 0, outstanding: 0, collectionRate: 0 }
  }

  const fromKey = toDateKey(from)
  const toExclusiveKey = toDateKey(nextDay(to))

  const [expectedRows, confirmedRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          expectedRent: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
        })
        .from(rentInvoices)
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            sql`${rentInvoices.dueDate} >= ${fromKey}::date`,
            sql`${rentInvoices.dueDate} < ${toExclusiveKey}::date`,
          ),
        ),
    ),
    withRetry(() =>
      db
        .select({
          confirmedRent: sql<string>`coalesce(sum(${payments.amountReceived}), 0)::text`,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            inArray(payments.status, ['paid', 'partial']),
            sql`${payments.verifiedAt} >= ${fromKey}::date`,
            sql`${payments.verifiedAt} < ${toExclusiveKey}::date`,
          ),
        ),
    ),
  ])

  const expectedRent = asNumber(expectedRows[0]?.expectedRent)
  const confirmedRent = asNumber(confirmedRows[0]?.confirmedRent)
  const outstanding = expectedRent - confirmedRent
  const collectionRate = expectedRent > 0 ? (confirmedRent / expectedRent) * 100 : 0

  return { expectedRent, confirmedRent, outstanding, collectionRate }
}

export async function getRentByProperty(userId: string, from: Date, to: Date): Promise<RentByProperty[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const fromKey = toDateKey(from)
  const toExclusiveKey = toDateKey(nextDay(to))
  const todayKey = toDateKey(new Date())

  const [propertyRows, expectedRows, confirmedRows, overdueRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          propertyId: properties.id,
          propertyName: properties.name,
          unitCount: properties.totalUnits,
        })
        .from(properties)
        .where(inArray(properties.id, propertyIds))
        .orderBy(asc(properties.name)),
    ),
    withRetry(() =>
      db
        .select({
          propertyId: units.propertyId,
          expectedRent: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
        })
        .from(rentInvoices)
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            sql`${rentInvoices.dueDate} >= ${fromKey}::date`,
            sql`${rentInvoices.dueDate} < ${toExclusiveKey}::date`,
          ),
        )
        .groupBy(units.propertyId),
    ),
    withRetry(() =>
      db
        .select({
          propertyId: units.propertyId,
          confirmedRent: sql<string>`coalesce(sum(${payments.amountReceived}), 0)::text`,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            inArray(payments.status, ['paid', 'partial']),
            sql`${payments.verifiedAt} >= ${fromKey}::date`,
            sql`${payments.verifiedAt} < ${toExclusiveKey}::date`,
          ),
        )
        .groupBy(units.propertyId),
    ),
    withRetry(() =>
      db
        .select({
          propertyId: units.propertyId,
          overdueCount: sql<number>`count(distinct ${rentInvoices.tenantId})::int`,
        })
        .from(rentInvoices)
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue']),
            sql`${rentInvoices.dueDate} >= ${fromKey}::date`,
            sql`${rentInvoices.dueDate} < ${toExclusiveKey}::date`,
            sql`${rentInvoices.dueDate} < ${todayKey}::date`,
          ),
        )
        .groupBy(units.propertyId),
    ),
  ])

  const expectedMap = new Map(expectedRows.map((row) => [row.propertyId, asNumber(row.expectedRent)]))
  const confirmedMap = new Map(confirmedRows.map((row) => [row.propertyId, asNumber(row.confirmedRent)]))
  const overdueMap = new Map(overdueRows.map((row) => [row.propertyId, row.overdueCount]))

  return propertyRows
    .map((row) => {
      const expectedRent = expectedMap.get(row.propertyId) ?? 0
      const confirmedRent = confirmedMap.get(row.propertyId) ?? 0
      const outstanding = expectedRent - confirmedRent
      const collectionRate = expectedRent > 0 ? (confirmedRent / expectedRent) * 100 : 0

      return {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        unitCount: row.unitCount,
        expectedRent,
        confirmedRent,
        outstanding,
        collectionRate,
        overdueCount: overdueMap.get(row.propertyId) ?? 0,
      } satisfies RentByProperty
    })
    .sort((a, b) => a.collectionRate - b.collectionRate)
}

export async function getOccupancySummary(userId: string): Promise<OccupancySummary> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) {
    return {
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      inactiveUnits: 0,
    }
  }

  const [propertyRows, unitRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          totalUnits: sql<number>`coalesce(sum(${properties.totalUnits}), 0)::int`,
        })
        .from(properties)
        .where(inArray(properties.id, propertyIds)),
    ),
    withRetry(() =>
      db
        .select({
          occupiedUnits: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
          vacantUnits: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
          inactiveUnits: sql<number>`count(*) filter (where ${units.status} = 'inactive')::int`,
        })
        .from(units)
        .where(inArray(units.propertyId, propertyIds)),
    ),
  ])

  return {
    totalUnits: propertyRows[0]?.totalUnits ?? 0,
    occupiedUnits: unitRows[0]?.occupiedUnits ?? 0,
    vacantUnits: unitRows[0]?.vacantUnits ?? 0,
    inactiveUnits: unitRows[0]?.inactiveUnits ?? 0,
  }
}

export async function getOccupancyByProperty(userId: string): Promise<OccupancyByProperty[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const [propertyRows, unitRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          propertyId: properties.id,
          propertyName: properties.name,
          totalUnits: properties.totalUnits,
        })
        .from(properties)
        .where(inArray(properties.id, propertyIds))
        .orderBy(asc(properties.name)),
    ),
    withRetry(() =>
      db
        .select({
          propertyId: units.propertyId,
          occupiedUnits: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
          vacantUnits: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
          inactiveUnits: sql<number>`count(*) filter (where ${units.status} = 'inactive')::int`,
        })
        .from(units)
        .where(inArray(units.propertyId, propertyIds))
        .groupBy(units.propertyId),
    ),
  ])

  const unitMap = new Map(
    unitRows.map((row) => [
      row.propertyId,
      {
        occupiedUnits: row.occupiedUnits ?? 0,
        vacantUnits: row.vacantUnits ?? 0,
        inactiveUnits: row.inactiveUnits ?? 0,
      },
    ]),
  )

  return propertyRows
    .map((row) => {
      const counts = unitMap.get(row.propertyId) ?? { occupiedUnits: 0, vacantUnits: 0, inactiveUnits: 0 }
      const occupancyRate = row.totalUnits > 0 ? (counts.occupiedUnits / row.totalUnits) * 100 : 0

      return {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        totalUnits: row.totalUnits,
        occupiedUnits: counts.occupiedUnits,
        vacantUnits: counts.vacantUnits,
        inactiveUnits: counts.inactiveUnits,
        occupancyRate,
      } satisfies OccupancyByProperty
    })
    .sort((a, b) => a.occupancyRate - b.occupancyRate)
}

export async function getOverdueTenants(userId: string, from: Date, to: Date): Promise<OverdueTenant[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const fromKey = toDateKey(from)
  const toExclusiveKey = toDateKey(nextDay(to))
  const todayKey = toDateKey(new Date())

  const [overdueRows, paymentRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          tenantId: tenants.id,
          tenantName: tenants.fullName,
          tenantPhone: tenants.phoneNumber,
          unitNumber: units.unitNumber,
          propertyName: properties.name,
          amountOverdue: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
          oldestDueDate: sql<string>`min(${rentInvoices.dueDate})::text`,
        })
        .from(rentInvoices)
        .innerJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .where(
          and(
            inArray(units.propertyId, propertyIds),
            inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue']),
            sql`${rentInvoices.dueDate} >= ${fromKey}::date`,
            sql`${rentInvoices.dueDate} < ${toExclusiveKey}::date`,
            sql`${rentInvoices.dueDate} < ${todayKey}::date`,
          ),
        )
        .groupBy(tenants.id, tenants.fullName, tenants.phoneNumber, units.unitNumber, properties.name),
    ),
    withRetry(() =>
      db
        .select({
          tenantId: payments.tenantId,
          lastPaymentDate: sql<Date | null>`max(${payments.verifiedAt})`,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .where(and(inArray(units.propertyId, propertyIds), inArray(payments.status, ['paid', 'partial'])))
        .groupBy(payments.tenantId),
    ),
  ])

  const paymentMap = new Map(paymentRows.map((row) => [row.tenantId, row.lastPaymentDate]))
  const today = new Date(todayKey)

  return overdueRows
    .map((row) => {
      const oldestDueDate = row.oldestDueDate ? new Date(row.oldestDueDate) : today
      const daysOverdue = Math.max(
        Math.floor((today.getTime() - oldestDueDate.getTime()) / (24 * 60 * 60 * 1000)),
        0,
      )

      return {
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        tenantPhone: row.tenantPhone,
        unitNumber: row.unitNumber,
        propertyName: row.propertyName,
        amountOverdue: asNumber(row.amountOverdue),
        daysOverdue,
        lastPaymentDate: paymentMap.get(row.tenantId) ?? null,
      } satisfies OverdueTenant
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export async function getPendingPayments(userId: string, limit = 10): Promise<PendingPaymentsResult> {
  const result = await getPaymentsByLandlord(userId, 1, limit, { status: 'pending_verification' })

  const rows: PendingPaymentReportItem[] = result.payments.map((payment) => ({
    id: payment.id,
    tenantName: payment.tenantName,
    unitNumber: payment.unitNumber,
    amount: payment.amountReceived ?? payment.amountExpected,
    mpesaCode: payment.mpesaCode,
    submittedAt: payment.submittedAt,
  }))

  return {
    rows,
    totalCount: result.totalCount,
  }
}

export async function getMaintenanceSummary(userId: string, from: Date, to: Date): Promise<MaintenanceSummary> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) {
    return { openCount: 0, inProgressCount: 0, resolvedCount: 0 }
  }

  const fromKey = toDateKey(from)
  const toExclusiveKey = toDateKey(nextDay(to))

  const [openRows, inProgressRows, resolvedRows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(
          and(
            inArray(maintenanceTickets.propertyId, propertyIds),
            eq(maintenanceTickets.status, 'open'),
            sql`${maintenanceTickets.createdAt} >= ${fromKey}::date`,
            sql`${maintenanceTickets.createdAt} < ${toExclusiveKey}::date`,
          ),
        ),
    ),
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(
          and(
            inArray(maintenanceTickets.propertyId, propertyIds),
            eq(maintenanceTickets.status, 'in_progress'),
            sql`${maintenanceTickets.createdAt} >= ${fromKey}::date`,
            sql`${maintenanceTickets.createdAt} < ${toExclusiveKey}::date`,
          ),
        ),
    ),
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(
          and(
            inArray(maintenanceTickets.propertyId, propertyIds),
            inArray(maintenanceTickets.status, ['resolved', 'closed']),
            sql`${maintenanceTickets.resolvedAt} >= ${fromKey}::date`,
            sql`${maintenanceTickets.resolvedAt} < ${toExclusiveKey}::date`,
          ),
        ),
    ),
  ])

  return {
    openCount: openRows[0]?.count ?? 0,
    inProgressCount: inProgressRows[0]?.count ?? 0,
    resolvedCount: resolvedRows[0]?.count ?? 0,
  }
}

export async function getMaintenanceByProperty(
  userId: string,
  from: Date,
  to: Date,
): Promise<MaintenanceByProperty[]> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) return []

  const fromKey = toDateKey(from)
  const toExclusiveKey = toDateKey(nextDay(to))

  const rows = await withRetry(() =>
    db
      .select({
        propertyId: properties.id,
        propertyName: properties.name,
        openCount: sql<number>`count(*) filter (where ${maintenanceTickets.status} = 'open')::int`,
        inProgressCount: sql<number>`count(*) filter (where ${maintenanceTickets.status} = 'in_progress')::int`,
        resolvedCount: sql<number>`count(*) filter (where ${maintenanceTickets.status} = 'resolved')::int`,
        closedCount: sql<number>`count(*) filter (where ${maintenanceTickets.status} = 'closed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(maintenanceTickets)
      .innerJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
      .where(
        and(
          inArray(maintenanceTickets.propertyId, propertyIds),
          sql`${maintenanceTickets.createdAt} >= ${fromKey}::date`,
          sql`${maintenanceTickets.createdAt} < ${toExclusiveKey}::date`,
        ),
      )
      .groupBy(properties.id, properties.name)
      .orderBy(desc(sql<number>`count(*)::int`), asc(properties.name)),
  )

  return rows.map((row) => ({
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    openCount: row.openCount,
    inProgressCount: row.inProgressCount,
    resolvedCount: row.resolvedCount,
    closedCount: row.closedCount,
    total: row.total,
  }))
}
