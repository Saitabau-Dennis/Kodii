import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  maintenanceTickets,
  payments,
  properties,
  rentInvoices,
  tenants,
  units,
  users,
} from '$lib/db/schema'
import { db } from '$lib/server/db'
import type { UnitStats, UnitWithDetails } from '$lib/types/units'

type UnitStatus = 'vacant' | 'occupied' | 'inactive'

type UnitFilters = {
  propertyId?: string | null
  status?: UnitStatus | 'all' | null
}

type UnitBaseRow = {
  id: string
  propertyId: string
  propertyName: string
  propertyOwnerId: string
  propertyLocation: string | null
  unitNumber: string
  monthlyRent: string | number
  status: UnitStatus
  tenantId: string | null
  tenantName: string | null
  tenantPhone: string | null
  tenantMoveInDate: string | null
  tenantRentDueDay: number | null
  paymentReference: string | null
  createdAt: Date
  currentInvoiceStatus: string | null
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

async function getUserScope(userId: string) {
  const [sessionUser] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )

  return sessionUser
}

async function getAccessiblePropertyIds(userId: string): Promise<string[]> {
  const scope = await getUserScope(userId)
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
      .where(
        and(
          eq(caretakerProperties.caretakerId, userId),
          eq(properties.ownerId, scope.invitedBy ?? ''),
        ),
      ),
  )
  return rows.map((row) => row.id)
}

function normalizeStatusFilter(status?: string | null): UnitStatus | 'all' {
  if (!status || status === 'all') return 'all'
  if (status === 'occupied' || status === 'vacant' || status === 'inactive') return status
  return 'all'
}

function mapUnitRow(row: UnitBaseRow): UnitWithDetails & {
  propertyOwnerId: string
  propertyLocation: string | null
  tenantMoveInDate: string | null
  tenantRentDueDay: number | null
  currentInvoiceStatus: string | null
} {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    propertyOwnerId: row.propertyOwnerId,
    propertyLocation: row.propertyLocation,
    unitNumber: row.unitNumber,
    monthlyRent: toNumber(row.monthlyRent),
    status: row.status,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantPhone: row.tenantPhone,
    tenantMoveInDate: row.tenantMoveInDate,
    tenantRentDueDay: row.tenantRentDueDay,
    paymentReference: row.paymentReference,
    createdAt: row.createdAt,
    currentInvoiceStatus: row.currentInvoiceStatus,
  }
}

function unitBaseSelect() {
  return {
    id: units.id,
    propertyId: units.propertyId,
    propertyName: properties.name,
    propertyOwnerId: properties.ownerId,
    propertyLocation: properties.location,
    unitNumber: units.unitNumber,
    monthlyRent: units.monthlyRent,
    status: units.status,
    tenantId: units.tenantId,
    tenantName: tenants.fullName,
    tenantPhone: tenants.phoneNumber,
    tenantMoveInDate: tenants.moveInDate,
    tenantRentDueDay: tenants.rentDueDay,
    paymentReference: units.paymentReference,
    createdAt: units.createdAt,
    currentInvoiceStatus: sql<string | null>`(
      select ${rentInvoices.status}
      from ${rentInvoices}
      where ${rentInvoices.unitId} = ${units.id}
      order by ${rentInvoices.dueDate} desc
      limit 1
    )`,
  }
}

function buildFilters(
  propertyIds: string[],
  filters: UnitFilters,
  mode: 'all' | 'single-property',
) {
  const whereClauses: any[] = []

  if (mode === 'all') {
    whereClauses.push(inArray(units.propertyId, propertyIds))
  } else if (filters.propertyId) {
    whereClauses.push(eq(units.propertyId, filters.propertyId))
  }

  const status = normalizeStatusFilter(filters.status ?? null)
  if (status !== 'all') {
    whereClauses.push(eq(units.status, status))
  }

  return whereClauses
}

/**
 * Existing dashboard helper: Returns current unit stats and last 6-month occupancy/vacancy trend.
 */
export async function getPortfolioUnitStats(userId: string): Promise<{
  occupied: number
  vacant: number
  total: number
  monthlyOccupancy: number[]
  monthlyVacant: number[]
}> {
  const propertyIds = await getAccessiblePropertyIds(userId)
  if (propertyIds.length === 0) {
    return {
      occupied: 0,
      vacant: 0,
      total: 0,
      monthlyOccupancy: Array(6).fill(0),
      monthlyVacant: Array(6).fill(0),
    }
  }

  const [currentRows, propertyTotalRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          occupied: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
          vacant: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
          actualTotal: sql<number>`count(*)::int`,
        })
        .from(units)
        .where(inArray(units.propertyId, propertyIds)),
    ),
    withRetry(() =>
      db
        .select({
          configuredTotal: sql<number>`coalesce(sum(${properties.totalUnits}), 0)::int`,
        })
        .from(properties)
        .where(inArray(properties.id, propertyIds)),
    ),
  ])
  const current = currentRows[0]
  const propertyTotals = propertyTotalRows[0]

  const now = new Date()
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const shift = 5 - index
    return new Date(now.getFullYear(), now.getMonth() - shift, 1)
  })

  const monthlyRows = await withRetry(() =>
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${units.createdAt}), 'YYYY-MM')`,
        occupied: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
        vacant: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
      })
      .from(units)
      .where(
        and(
          inArray(units.propertyId, propertyIds),
          sql`${units.createdAt} >= ${monthStarts[0]}`,
          sql`${units.createdAt} < ${new Date(now.getFullYear(), now.getMonth() + 1, 1)}`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${units.createdAt})`),
  )

  const monthlyMap = new Map(monthlyRows.map((row) => [row.month, row]))
  const monthlyOccupancy = monthStarts.map((month) => {
    const key = month.toISOString().slice(0, 7)
    return monthlyMap.get(key)?.occupied ?? current?.occupied ?? 0
  })
  const monthlyVacant = monthStarts.map((month) => {
    const key = month.toISOString().slice(0, 7)
    return monthlyMap.get(key)?.vacant ?? current?.vacant ?? 0
  })

  return {
    occupied: current?.occupied ?? 0,
    vacant: current?.vacant ?? 0,
    total: propertyTotals?.configuredTotal ?? current?.actualTotal ?? 0,
    monthlyOccupancy,
    monthlyVacant,
  }
}

/**
 * Returns units for landlord with pagination and filters.
 */
export async function getUnitsByLandlord(
  landlordId: string,
  page: number,
  limit: number,
  filters: UnitFilters,
): Promise<{ units: ReturnType<typeof mapUnitRow>[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const propertyRows = await withRetry(() =>
    db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.ownerId, landlordId)),
  )
  const propertyIds = propertyRows.map((row) => row.id)

  if (propertyIds.length === 0) return { units: [], totalCount: 0 }

  const effectivePropertyIds =
    filters.propertyId && propertyIds.includes(filters.propertyId) ? [filters.propertyId] : propertyIds

  const whereClauses = buildFilters(effectivePropertyIds, filters, 'all')

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(unitBaseSelect())
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .leftJoin(tenants, eq(units.tenantId, tenants.id))
        .where(and(...whereClauses))
        .orderBy(desc(units.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    units: rows.map((row) => mapUnitRow(row as UnitBaseRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

/**
 * Returns units for caretaker from assigned properties with pagination and filters.
 */
export async function getUnitsByCaretaker(
  caretakerId: string,
  page: number,
  limit: number,
  filters: UnitFilters,
): Promise<{ units: ReturnType<typeof mapUnitRow>[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const propertyRows = await withRetry(() =>
    db
      .select({ id: caretakerProperties.propertyId })
      .from(caretakerProperties)
      .where(eq(caretakerProperties.caretakerId, caretakerId)),
  )
  const propertyIds = propertyRows.map((row) => row.id)
  if (propertyIds.length === 0) return { units: [], totalCount: 0 }

  const effectivePropertyIds =
    filters.propertyId && propertyIds.includes(filters.propertyId) ? [filters.propertyId] : propertyIds

  const whereClauses = buildFilters(effectivePropertyIds, filters, 'all')

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(units)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(unitBaseSelect())
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .leftJoin(tenants, eq(units.tenantId, tenants.id))
        .where(and(...whereClauses))
        .orderBy(desc(units.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    units: rows.map((row) => mapUnitRow(row as UnitBaseRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

/**
 * Returns properties available to user for filter dropdown.
 */
export async function getUnitFilterProperties(userId: string): Promise<Array<{ id: string; name: string }>> {
  const scope = await getUserScope(userId)
  if (!scope) return []

  if (scope.role === 'landlord') {
    return withRetry(() =>
      db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.ownerId, userId))
        .orderBy(properties.name),
    )
  }

  return withRetry(() =>
    db
      .select({ id: properties.id, name: properties.name })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(eq(caretakerProperties.caretakerId, userId))
      .groupBy(properties.id, properties.name)
      .orderBy(properties.name),
  )
}

/**
 * Returns unit by id with property + tenant details.
 */
export async function getUnitById(unitId: string): Promise<ReturnType<typeof mapUnitRow> | undefined> {
  const [row] = await withRetry(() =>
    db
      .select(unitBaseSelect())
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(tenants, eq(units.tenantId, tenants.id))
      .where(eq(units.id, unitId))
      .limit(1),
  )

  return row ? mapUnitRow(row as UnitBaseRow) : undefined
}

/**
 * Returns unit detail stats.
 */
export async function getUnitStats(unitId: string): Promise<UnitStats> {
  const [paidRow, expectedRow, lastPaymentRow, ticketsRow] = await Promise.all([
    withRetry(() =>
      db
        .select({
          totalPaid: sql<string>`coalesce(sum(coalesce(${payments.amountReceived}, ${payments.amountExpected})), 0)::text`,
        })
        .from(payments)
        .where(and(eq(payments.unitId, unitId), eq(payments.status, 'paid'))),
    ),
    withRetry(() =>
      db
        .select({
          expected: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
        })
        .from(rentInvoices)
        .where(eq(rentInvoices.unitId, unitId)),
    ),
    withRetry(() =>
      db
        .select({
          submittedAt: payments.submittedAt,
          amount: sql<string>`coalesce(${payments.amountReceived}, ${payments.amountExpected})::text`,
        })
        .from(payments)
        .where(and(eq(payments.unitId, unitId), sql`${payments.submittedAt} is not null`))
        .orderBy(desc(payments.submittedAt))
        .limit(1),
    ),
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(and(eq(maintenanceTickets.unitId, unitId), eq(maintenanceTickets.status, 'open'))),
    ),
  ])

  const totalPaid = toNumber(paidRow[0]?.totalPaid)
  const expected = toNumber(expectedRow[0]?.expected)

  return {
    totalPaid,
    outstanding: Math.max(expected - totalPaid, 0),
    lastPaymentDate: lastPaymentRow[0]?.submittedAt ?? null,
    lastPaymentAmount: lastPaymentRow[0] ? toNumber(lastPaymentRow[0].amount) : null,
    openTickets: ticketsRow[0]?.count ?? 0,
  }
}

export async function getUnitPaymentHistory(unitId: string, page: number, limit: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(eq(payments.unitId, unitId)),
    ),
    withRetry(() =>
      db
        .select({
          id: payments.id,
          date: payments.submittedAt,
          amount: sql<string>`coalesce(${payments.amountReceived}, ${payments.amountExpected})::text`,
          mpesaCode: payments.mpesaCode,
          status: payments.status,
          verifiedBy: users.name,
        })
        .from(payments)
        .leftJoin(users, eq(payments.verifiedBy, users.id))
        .where(eq(payments.unitId, unitId))
        .orderBy(desc(payments.submittedAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    totalCount: countRows[0]?.count ?? 0,
    payments: rows.map((row) => ({
      id: row.id,
      date: row.date ? row.date.toISOString() : null,
      amount: toNumber(row.amount),
      mpesaCode: row.mpesaCode,
      status: row.status,
      verifiedBy: row.verifiedBy ?? '—',
    })),
  }
}

export async function getUnitMaintenanceTickets(unitId: string, limit = 5) {
  const rows = await withRetry(() =>
    db
      .select({
        id: maintenanceTickets.id,
        category: maintenanceTickets.category,
        description: maintenanceTickets.description,
        status: maintenanceTickets.status,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.unitId, unitId))
      .orderBy(desc(maintenanceTickets.createdAt))
      .limit(limit),
  )

  return rows.map((row) => ({
    ...row,
    date: row.createdAt.toISOString(),
  }))
}

export async function createUnit(data: {
  propertyId: string
  unitNumber: string
  monthlyRent: number
  paymentReference?: string | null
  status?: 'vacant' | 'inactive'
}) {
  const [existing] = await withRetry(() =>
    db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.propertyId, data.propertyId), eq(units.unitNumber, data.unitNumber)))
      .limit(1),
  )
  if (existing) {
    throw new Error(`Unit ${data.unitNumber} already exists in this property`)
  }

  const [created] = await withRetry(() =>
    db
      .insert(units)
      .values({
        propertyId: data.propertyId,
        unitNumber: data.unitNumber,
        monthlyRent: data.monthlyRent.toString(),
        paymentReference: data.paymentReference ?? null,
        status: data.status ?? 'vacant',
      })
      .returning(),
  )

  return created
}

export async function updateUnit(
  id: string,
  data: {
    propertyId: string
    unitNumber: string
    monthlyRent: number
    paymentReference?: string | null
    status?: 'vacant' | 'inactive'
  },
) {
  const [existing] = await withRetry(() =>
    db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.propertyId, data.propertyId),
          eq(units.unitNumber, data.unitNumber),
          ne(units.id, id),
        ),
      )
      .limit(1),
  )
  if (existing) {
    throw new Error(`Unit ${data.unitNumber} already exists in this property`)
  }

  const [updated] = await withRetry(() =>
    db
      .update(units)
      .set({
        propertyId: data.propertyId,
        unitNumber: data.unitNumber,
        monthlyRent: data.monthlyRent.toString(),
        paymentReference: data.paymentReference ?? null,
        status: data.status ?? 'vacant',
      })
      .where(eq(units.id, id))
      .returning(),
  )

  return updated
}

export async function deleteUnit(id: string) {
  const [unit] = await withRetry(() =>
    db
      .select({ id: units.id, status: units.status, tenantId: units.tenantId })
      .from(units)
      .where(eq(units.id, id))
      .limit(1),
  )

  if (!unit) return
  if (unit.status === 'occupied' || unit.tenantId) {
    throw new Error('Cannot delete an occupied unit.\nRemove the tenant first.')
  }

  await withRetry(() => db.delete(units).where(eq(units.id, id)))
}

export async function markUnitVacant(id: string) {
  const [updated] = await withRetry(() =>
    db
      .update(units)
      .set({ status: 'vacant', tenantId: null })
      .where(eq(units.id, id))
      .returning(),
  )
  return updated
}

export async function markUnitInactive(id: string) {
  const [updated] = await withRetry(() =>
    db
      .update(units)
      .set({ status: 'inactive' })
      .where(eq(units.id, id))
      .returning(),
  )
  return updated
}

export async function unitBelongsToLandlord(unitId: string, landlordId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: units.id })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(and(eq(units.id, unitId), eq(properties.ownerId, landlordId)))
      .limit(1),
  )
  return Boolean(row)
}

export async function unitAccessibleToCaretaker(unitId: string, caretakerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: units.id })
      .from(units)
      .innerJoin(caretakerProperties, eq(units.propertyId, caretakerProperties.propertyId))
      .where(and(eq(units.id, unitId), eq(caretakerProperties.caretakerId, caretakerId)))
      .limit(1),
  )
  return Boolean(row)
}

export async function logUnitActivity(actorId: string, action: string, unitId: string, metadata?: unknown) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId,
      action,
      entityType: 'unit',
      entityId: unitId,
      metadata: metadata as any,
    }),
  )
}
