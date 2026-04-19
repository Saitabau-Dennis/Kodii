import { and, eq, inArray, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
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
import type { PropertyStats, PropertyWithStats } from '$lib/types/properties'

type PropertyBase = Pick<
  typeof properties.$inferSelect,
  | 'id'
  | 'ownerId'
  | 'name'
  | 'location'
  | 'totalUnits'
  | 'caretakerName'
  | 'caretakerPhone'
  | 'notes'
  | 'createdAt'
>

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

function getCurrentMonthRange() {
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)

  return {
    start,
    next,
    startDate: start.toISOString().slice(0, 10),
    nextDate: next.toISOString().slice(0, 10),
  }
}

async function getStatsMap(propertyIds: string[]): Promise<Map<string, Omit<PropertyWithStats, keyof PropertyBase>>> {
  const statsMap = new Map<string, Omit<PropertyWithStats, keyof PropertyBase>>()
  if (propertyIds.length === 0) return statsMap

  const { startDate, nextDate } = getCurrentMonthRange()

  const [unitRows, expectedRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          propertyId: sql<string>`${units.propertyId}`,
          actualUnits: sql<number>`count(*)::int`,
          occupiedUnits: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
          vacantUnits: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
        })
        .from(units)
        .where(inArray(units.propertyId, propertyIds))
        .groupBy(sql`${units.propertyId}`),
    ),
    withRetry(() =>
      db
        .select({
          propertyId: sql<string>`${units.propertyId}`,
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
        )
        .groupBy(sql`${units.propertyId}`),
    ),
  ])

  for (const propertyId of propertyIds) {
    statsMap.set(propertyId, {
      actualUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      expectedRent: 0,
    })
  }

  for (const row of unitRows) {
    const current = statsMap.get(row.propertyId)
    if (!current) continue
    statsMap.set(row.propertyId, {
      ...current,
      actualUnits: row.actualUnits ?? 0,
      occupiedUnits: row.occupiedUnits ?? 0,
      vacantUnits: row.vacantUnits ?? 0,
    })
  }

  for (const row of expectedRows) {
    const current = statsMap.get(row.propertyId)
    if (!current) continue
    statsMap.set(row.propertyId, {
      ...current,
      expectedRent: toNumber(row.expectedRent),
    })
  }

  return statsMap
}

async function getAssignedCaretakerMap(propertyIds: string[]): Promise<Map<string, { name: string | null; phone: string | null }>> {
  const map = new Map<string, { name: string | null; phone: string | null }>()
  if (propertyIds.length === 0) return map

  const rows = await withRetry(() =>
    db
      .select({
        propertyId: caretakerProperties.propertyId,
        caretakerName: users.name,
        caretakerPhone: users.phone,
      })
      .from(caretakerProperties)
      .innerJoin(users, eq(caretakerProperties.caretakerId, users.id))
      .where(inArray(caretakerProperties.propertyId, propertyIds)),
  )

  const grouped = new Map<string, Array<{ name: string; phone: string }>>()
  for (const row of rows) {
    const list = grouped.get(row.propertyId) ?? []
    list.push({ name: row.caretakerName, phone: row.caretakerPhone })
    grouped.set(row.propertyId, list)
  }

  for (const [propertyId, caretakers] of grouped) {
    if (caretakers.length === 0) {
      map.set(propertyId, { name: null, phone: null })
      continue
    }

    map.set(propertyId, {
      name: caretakers.map((caretaker) => caretaker.name).join(', '),
      phone: caretakers[0]?.phone ?? null,
    })
  }

  return map
}

function mergePropertyStats(
  propertyRows: PropertyBase[],
  statsMap: Map<string, Omit<PropertyWithStats, keyof PropertyBase>>,
  caretakerMap: Map<string, { name: string | null; phone: string | null }>,
) {
  return propertyRows.map((row) => {
    const stats = statsMap.get(row.id) ?? {
      actualUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      expectedRent: 0,
    }
    const assignedCaretaker = caretakerMap.get(row.id)

    return {
      id: row.id,
      name: row.name,
      location: row.location,
      totalUnits: row.totalUnits,
      caretakerName: assignedCaretaker?.name ?? row.caretakerName,
      caretakerPhone: assignedCaretaker?.phone ?? row.caretakerPhone,
      notes: row.notes,
      createdAt: row.createdAt,
      actualUnits: stats.actualUnits,
      occupiedUnits: stats.occupiedUnits,
      vacantUnits: stats.vacantUnits,
      expectedRent: stats.expectedRent,
    } satisfies PropertyWithStats
  })
}

/**
 * Returns landlord properties with summary stats (paginated).
 */
export async function getPropertiesByLandlord(
  landlordId: string,
  page: number,
  limit: number,
): Promise<{ properties: PropertyWithStats[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const [countRow] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.ownerId, landlordId)),
  )

  const propertyRows = await withRetry(() =>
    db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
        caretakerName: properties.caretakerName,
        caretakerPhone: properties.caretakerPhone,
        notes: properties.notes,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(eq(properties.ownerId, landlordId))
      .orderBy(sql`${properties.createdAt} desc`)
      .limit(safeLimit)
      .offset(offset),
  )

  const propertyIds = propertyRows.map((row) => row.id)
  const [statsMap, caretakerMap] = await Promise.all([
    getStatsMap(propertyIds),
    getAssignedCaretakerMap(propertyIds),
  ])

  return {
    properties: mergePropertyStats(propertyRows, statsMap, caretakerMap),
    totalCount: countRow?.count ?? 0,
  }
}

/**
 * Returns caretaker assigned properties with summary stats (paginated).
 */
export async function getPropertiesByCaretaker(
  caretakerId: string,
  page: number,
  limit: number,
): Promise<{ properties: PropertyWithStats[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const [countRow] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(distinct ${properties.id})::int` })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(eq(caretakerProperties.caretakerId, caretakerId)),
  )

  const propertyRows = await withRetry(() =>
    db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
        caretakerName: properties.caretakerName,
        caretakerPhone: properties.caretakerPhone,
        notes: properties.notes,
        createdAt: properties.createdAt,
      })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(eq(caretakerProperties.caretakerId, caretakerId))
      .groupBy(
        properties.id,
        properties.ownerId,
        properties.name,
        properties.location,
        properties.caretakerName,
        properties.caretakerPhone,
        properties.notes,
        properties.createdAt,
      )
      .orderBy(sql`${properties.createdAt} desc`)
      .limit(safeLimit)
      .offset(offset),
  )

  const propertyIds = propertyRows.map((row) => row.id)
  const [statsMap, caretakerMap] = await Promise.all([
    getStatsMap(propertyIds),
    getAssignedCaretakerMap(propertyIds),
  ])

  return {
    properties: mergePropertyStats(propertyRows, statsMap, caretakerMap),
    totalCount: countRow?.count ?? 0,
  }
}

/**
 * Returns a single property by id.
 */
export async function getPropertyById(propertyId: string): Promise<PropertyBase | undefined> {
  const [property] = await withRetry(() =>
    db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
        caretakerName: properties.caretakerName,
        caretakerPhone: properties.caretakerPhone,
        notes: properties.notes,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1),
  )

  if (!property) return undefined

  const caretakerMap = await getAssignedCaretakerMap([propertyId])
  const assignedCaretaker = caretakerMap.get(propertyId)

  return {
    ...property,
    caretakerName: assignedCaretaker?.name ?? property.caretakerName,
    caretakerPhone: assignedCaretaker?.phone ?? property.caretakerPhone,
  }
}

/**
 * Creates a property for landlord.
 */
export async function createProperty(
  data: {
    name: string
    location: string
    totalUnits: number
    caretakerName?: string | null
    caretakerPhone?: string | null
    notes?: string | null
  },
  ownerId: string,
): Promise<PropertyBase> {
  const [created] = await withRetry(() =>
    db
      .insert(properties)
      .values({
        ownerId,
        name: data.name,
        location: data.location,
        totalUnits: data.totalUnits,
        caretakerName: data.caretakerName ?? null,
        caretakerPhone: data.caretakerPhone ?? null,
        notes: data.notes ?? null,
      })
      .returning({
        id: properties.id,
        ownerId: properties.ownerId,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
        caretakerName: properties.caretakerName,
        caretakerPhone: properties.caretakerPhone,
        notes: properties.notes,
        createdAt: properties.createdAt,
      }),
  )

  return created
}

/**
 * Updates a property.
 */
export async function updateProperty(
  propertyId: string,
  data: {
    name: string
    location: string
    totalUnits: number
    caretakerName?: string | null
    caretakerPhone?: string | null
    notes?: string | null
  },
): Promise<PropertyBase | undefined> {
  const [updated] = await withRetry(() =>
    db
      .update(properties)
      .set({
        name: data.name,
        location: data.location,
        totalUnits: data.totalUnits,
        caretakerName: data.caretakerName ?? null,
        caretakerPhone: data.caretakerPhone ?? null,
        notes: data.notes ?? null,
      })
      .where(eq(properties.id, propertyId))
      .returning({
        id: properties.id,
        ownerId: properties.ownerId,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
        caretakerName: properties.caretakerName,
        caretakerPhone: properties.caretakerPhone,
        notes: properties.notes,
        createdAt: properties.createdAt,
      }),
  )

  return updated
}

/**
 * Deletes a property if it has no units.
 */
export async function deleteProperty(propertyId: string): Promise<void> {
  const [unitCountRow] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(units)
      .where(eq(units.propertyId, propertyId)),
  )

  if ((unitCountRow?.count ?? 0) > 0) {
    throw new Error('Cannot delete a property that has units.\nRemove all units first.')
  }

  await withRetry(() => db.delete(properties).where(eq(properties.id, propertyId)))
}

/**
 * Returns full property stats for current month.
 */
export async function getPropertyStats(propertyId: string): Promise<PropertyStats> {
  const { start, next, startDate, nextDate } = getCurrentMonthRange()

  const [propertyRow, unitsRow, expectedRow, confirmedRow, ticketsRow] = await Promise.all([
    withRetry(() =>
      db
        .select({ totalUnits: properties.totalUnits })
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1),
    ),
    withRetry(() =>
      db
        .select({
          actualUnits: sql<number>`count(*)::int`,
          occupiedUnits: sql<number>`count(*) filter (where ${units.status} = 'occupied')::int`,
          vacantUnits: sql<number>`count(*) filter (where ${units.status} = 'vacant')::int`,
        })
        .from(units)
        .where(eq(units.propertyId, propertyId)),
    ),
    withRetry(() =>
      db
        .select({
          expectedRent: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
        })
        .from(rentInvoices)
        .innerJoin(units, eq(rentInvoices.unitId, units.id))
        .where(
          and(
            eq(units.propertyId, propertyId),
            sql`${rentInvoices.dueDate} >= ${startDate}::date`,
            sql`${rentInvoices.dueDate} < ${nextDate}::date`,
          ),
        ),
    ),
    withRetry(() =>
      db
        .select({
          confirmedRent: sql<string>`coalesce(sum(coalesce(${payments.amountReceived}, ${payments.amountExpected})), 0)::text`,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .where(
          and(
            eq(units.propertyId, propertyId),
            eq(payments.status, 'paid'),
            sql`${payments.submittedAt} is not null`,
            sql`${payments.submittedAt} >= ${start}`,
            sql`${payments.submittedAt} < ${next}`,
          ),
        ),
    ),
    withRetry(() =>
      db
        .select({
          openTickets: sql<number>`count(*)::int`,
        })
        .from(maintenanceTickets)
        .where(and(eq(maintenanceTickets.propertyId, propertyId), eq(maintenanceTickets.status, 'open'))),
    ),
  ])

  const expectedRent = toNumber(expectedRow[0]?.expectedRent)
  const confirmedRent = toNumber(confirmedRow[0]?.confirmedRent)

  return {
    totalUnits: propertyRow[0]?.totalUnits ?? 0,
    actualUnits: unitsRow[0]?.actualUnits ?? 0,
    occupiedUnits: unitsRow[0]?.occupiedUnits ?? 0,
    vacantUnits: unitsRow[0]?.vacantUnits ?? 0,
    expectedRent,
    confirmedRent,
    outstanding: Math.max(expectedRent - confirmedRent, 0),
    openTickets: ticketsRow[0]?.openTickets ?? 0,
  }
}

export async function isPropertyAssignedToCaretaker(
  caretakerId: string,
  propertyId: string,
): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: caretakerProperties.id })
      .from(caretakerProperties)
      .where(
        and(
          eq(caretakerProperties.caretakerId, caretakerId),
          eq(caretakerProperties.propertyId, propertyId),
        ),
      )
      .limit(1),
  )

  return Boolean(row)
}

export async function getPropertyUnits(propertyId: string): Promise<
  Array<{
    id: string
    unitNumber: string
    monthlyRent: number
    status: 'vacant' | 'occupied' | 'inactive'
    tenantName: string | null
  }>
> {
  const rows = await withRetry(() =>
    db
      .select({
        id: units.id,
        unitNumber: units.unitNumber,
        monthlyRent: units.monthlyRent,
        status: units.status,
        tenantName: tenants.fullName,
      })
      .from(units)
      .leftJoin(tenants, eq(units.tenantId, tenants.id))
      .where(eq(units.propertyId, propertyId))
      .orderBy(units.unitNumber),
  )

  return rows.map((row) => ({
    id: row.id,
    unitNumber: row.unitNumber,
    monthlyRent: toNumber(row.monthlyRent),
    status: row.status,
    tenantName: row.tenantName ?? null,
  }))
}

export async function getRecentPropertyPayments(propertyId: string, limit = 5): Promise<
  Array<{
    id: string
    tenantName: string
    unitNumber: string
    amount: number
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected'
    date: string
  }>
> {
  const rows = await withRetry(() =>
    db
      .select({
        id: payments.id,
        tenantName: tenants.fullName,
        unitNumber: units.unitNumber,
        amountExpected: payments.amountExpected,
        amountReceived: payments.amountReceived,
        status: payments.status,
        submittedAt: payments.submittedAt,
      })
      .from(payments)
      .innerJoin(units, eq(payments.unitId, units.id))
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .where(eq(units.propertyId, propertyId))
      .orderBy(sql`${payments.submittedAt} desc nulls last`)
      .limit(limit),
  )

  return rows.map((row) => ({
    id: row.id,
    tenantName: row.tenantName,
    unitNumber: row.unitNumber,
    amount: toNumber(row.amountReceived ?? row.amountExpected),
    status: row.status,
    date: (row.submittedAt ?? new Date()).toISOString(),
  }))
}

export async function getOpenPropertyTickets(propertyId: string, limit = 5): Promise<
  Array<{
    id: string
    unitNumber: string
    category: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    date: string
  }>
> {
  const rows = await withRetry(() =>
    db
      .select({
        id: maintenanceTickets.id,
        unitNumber: units.unitNumber,
        category: maintenanceTickets.category,
        status: maintenanceTickets.status,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
      .where(and(eq(maintenanceTickets.propertyId, propertyId), eq(maintenanceTickets.status, 'open')))
      .orderBy(sql`${maintenanceTickets.createdAt} desc`)
      .limit(limit),
  )

  return rows.map((row) => ({
    id: row.id,
    unitNumber: row.unitNumber,
    category: row.category,
    status: row.status,
    date: row.createdAt.toISOString(),
  }))
}
