import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  maintenanceTickets,
  notices,
  payments,
  properties,
  rentInvoices,
  tenants,
  units,
  users,
} from '$lib/db/schema'
import { normalizePhone } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { sendSMS } from '$lib/server/sms'
import { sendRentInvoiceSMS } from '$lib/services/invoices'
import type { TenantStats, TenantWithDetails, TenantWithUnit } from '$lib/types/tenants'

type TenantStatus = 'active' | 'inactive' | 'moved_out'

type TenantFilters = {
  propertyId?: string | null
  status?: TenantStatus | 'all' | null
}

type TenantBaseRow = {
  id: string
  fullName: string
  phoneNumber: string
  idNumber: string | null
  propertyId: string
  propertyName: string
  propertyOwnerId: string
  unitId: string | null
  unitNumber: string | null
  monthlyRent: string | number | null
  moveInDate: string
  moveOutDate: string | null
  rentDueDay: number
  securityDeposit: string | number
  creditBalance: string | number
  status: TenantStatus
  createdAt: Date
  currentInvoiceStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' | null
  outstanding: string
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

function tenantSelect() {
  return {
    id: tenants.id,
    fullName: tenants.fullName,
    phoneNumber: tenants.phoneNumber,
    idNumber: tenants.idNumber,
    propertyId: tenants.propertyId,
    propertyName: properties.name,
    propertyOwnerId: properties.ownerId,
    unitId: tenants.unitId,
    unitNumber: units.unitNumber,
    monthlyRent: units.monthlyRent,
    moveInDate: tenants.moveInDate,
    moveOutDate: tenants.moveOutDate,
    rentDueDay: tenants.rentDueDay,
    securityDeposit: tenants.securityDeposit,
    creditBalance: tenants.creditBalance,
    status: tenants.status,
    createdAt: tenants.createdAt,
    currentInvoiceStatus: sql<'unpaid' | 'partial' | 'paid' | 'overdue' | null>`(
      select ${rentInvoices.status}
      from ${rentInvoices}
      where ${rentInvoices.tenantId} = ${tenants.id}
      order by ${rentInvoices.dueDate} desc
      limit 1
    )`,
    outstanding: sql<string>`(
      select coalesce(sum(${rentInvoices.amount}), 0)::text
      from ${rentInvoices}
      where ${rentInvoices.tenantId} = ${tenants.id}
        and ${rentInvoices.status} in ('unpaid', 'partial', 'overdue')
    )`,
  }
}

function mapTenantRow(row: TenantBaseRow): TenantWithUnit & {
  propertyOwnerId: string
  currentInvoiceStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' | null
} {
  return {
    id: row.id,
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    idNumber: row.idNumber,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    unitId: row.unitId,
    unitNumber: row.unitNumber,
    moveInDate: row.moveInDate,
    moveOutDate: row.moveOutDate,
    rentDueDay: row.rentDueDay,
    securityDeposit: toNumber(row.securityDeposit),
    creditBalance: toNumber(row.creditBalance),
    status: row.status,
    outstanding: toNumber(row.outstanding),
    createdAt: row.createdAt,
    monthlyRent: toNumber(row.monthlyRent),
    propertyOwnerId: row.propertyOwnerId,
    currentInvoiceStatus: row.currentInvoiceStatus,
  }
}

function normalizeStatusFilter(status?: string | null): TenantStatus | 'all' {
  if (!status || status === 'all') return 'all'
  if (status === 'active' || status === 'inactive' || status === 'moved_out') return status
  return 'all'
}

async function getUserScope(userId: string) {
  const [scope] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )
  return scope
}

async function getScopedPropertyIds(userId: string): Promise<string[]> {
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

function buildWhereClauses(propertyIds: string[], filters: TenantFilters) {
  const whereClauses: any[] = [inArray(tenants.propertyId, propertyIds)]

  if (filters.propertyId && propertyIds.includes(filters.propertyId)) {
    whereClauses.push(eq(tenants.propertyId, filters.propertyId))
  }

  const status = normalizeStatusFilter(filters.status ?? null)
  if (status !== 'all') whereClauses.push(eq(tenants.status, status))

  return whereClauses
}

function getMonthDueDate(rentDueDay: number): string {
  const now = new Date()
  const day = Math.max(1, Math.min(28, rentDueDay))
  return new Date(now.getFullYear(), now.getMonth(), day).toISOString().slice(0, 10)
}

async function sendWelcomeTenantSMS(input: {
  phone: string
  name: string
  propertyName: string
  unitNumber: string
  rent: number
  rentDueDay: number
}) {
  const msg =
    `Your tenancy at ${input.propertyName} is now active. ` +
    `You have been assigned Unit ${input.unitNumber}. ` +
    `Your rent of KES ${input.rent.toLocaleString('en-KE')} is due on the ${input.rentDueDay}th of each month. ` +
    `After payment, please send: PAY <MPESA_CODE> to this number. Thank you.`
  await sendSMS({ to: input.phone, message: msg })
}

async function sendMoveOutSMS(input: {
  phone: string
  name: string
  unitNumber: string
  propertyName: string
  moveOutDate: string
}) {
  const msg =
    `Your tenancy at Unit ${input.unitNumber}, ${input.propertyName} ` +
    `ended on ${input.moveOutDate}. Thank you for staying with us.`
  await sendSMS({ to: input.phone, message: msg })
}

/**
 * Returns tenants for landlord with pagination and filters.
 */
export async function getTenantsByLandlord(
  landlordId: string,
  page: number,
  limit: number,
  filters: TenantFilters,
): Promise<{ tenants: ReturnType<typeof mapTenantRow>[]; totalCount: number }> {
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
  if (propertyIds.length === 0) return { tenants: [], totalCount: 0 }

  const whereClauses = buildWhereClauses(propertyIds, filters)

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(tenantSelect())
        .from(tenants)
        .innerJoin(properties, eq(tenants.propertyId, properties.id))
        .leftJoin(units, eq(tenants.unitId, units.id))
        .where(and(...whereClauses))
        .orderBy(desc(tenants.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    tenants: rows.map((row) => mapTenantRow(row as TenantBaseRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

/**
 * Returns tenants for caretaker from assigned properties with pagination and filters.
 */
export async function getTenantsByCaretaker(
  caretakerId: string,
  page: number,
  limit: number,
  filters: TenantFilters,
): Promise<{ tenants: ReturnType<typeof mapTenantRow>[]; totalCount: number }> {
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
  if (propertyIds.length === 0) return { tenants: [], totalCount: 0 }

  const whereClauses = buildWhereClauses(propertyIds, filters)

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(tenantSelect())
        .from(tenants)
        .innerJoin(properties, eq(tenants.propertyId, properties.id))
        .leftJoin(units, eq(tenants.unitId, units.id))
        .where(and(...whereClauses))
        .orderBy(desc(tenants.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    tenants: rows.map((row) => mapTenantRow(row as TenantBaseRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

/**
 * Returns properties available to user for tenant filters/forms.
 */
export async function getTenantFilterProperties(userId: string): Promise<Array<{ id: string; name: string }>> {
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
 * Returns a tenant by id with property/unit details.
 */
export async function getTenantById(id: string): Promise<
  | (ReturnType<typeof mapTenantRow> & {
      propertyOwnerId: string
      currentInvoiceStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' | null
    })
  | undefined
> {
  const [row] = await withRetry(() =>
    db
      .select(tenantSelect())
      .from(tenants)
      .innerJoin(properties, eq(tenants.propertyId, properties.id))
      .leftJoin(units, eq(tenants.unitId, units.id))
      .where(eq(tenants.id, id))
      .limit(1),
  )

  return row ? mapTenantRow(row as TenantBaseRow) : undefined
}

/**
 * Returns aggregate stats for tenant detail view.
 */
export async function getTenantStats(tenantId: string): Promise<TenantStats> {
  const [tenant] = await withRetry(() =>
    db
      .select({
        moveInDate: tenants.moveInDate,
        securityDeposit: tenants.securityDeposit,
        creditBalance: tenants.creditBalance,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  )

  const [paidRow, invoiceRow] = await Promise.all([
    withRetry(() =>
      db
        .select({
          totalPaid: sql<string>`coalesce(sum(coalesce(${payments.amountReceived}, ${payments.amountExpected})), 0)::text`,
        })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.status, 'paid'))),
    ),
    withRetry(() =>
      db
        .select({
          outstanding: sql<string>`coalesce(sum(${rentInvoices.amount}), 0)::text`,
          totalInvoices: sql<number>`count(*)::int`,
        })
        .from(rentInvoices)
        .where(
          and(
            eq(rentInvoices.tenantId, tenantId),
            inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue']),
          ),
        ),
    ),
  ])

  const moveIn = tenant?.moveInDate ? new Date(tenant.moveInDate) : null
  const now = new Date()
  const monthsStayed = moveIn
    ? Math.max(0, (now.getFullYear() - moveIn.getFullYear()) * 12 + (now.getMonth() - moveIn.getMonth()))
    : 0

  const creditBalance = toNumber(tenant?.creditBalance)
  const [tenantRent] = await withRetry(() =>
    db
      .select({ monthlyRent: units.monthlyRent })
      .from(tenants)
      .leftJoin(units, eq(tenants.unitId, units.id))
      .where(eq(tenants.id, tenantId))
      .limit(1),
  )
  const monthlyRent = toNumber(tenantRent?.monthlyRent)
  const monthsPaidAhead = monthlyRent > 0 ? Math.floor(creditBalance / monthlyRent) : 0
  const remainingCredit = monthlyRent > 0 ? creditBalance % monthlyRent : creditBalance

  return {
    totalPaid: toNumber(paidRow[0]?.totalPaid),
    outstanding: toNumber(invoiceRow[0]?.outstanding),
    totalInvoices: invoiceRow[0]?.totalInvoices ?? 0,
    securityDeposit: toNumber(tenant?.securityDeposit),
    creditBalance,
    monthsPaidAhead,
    remainingCredit,
    monthsStayed,
  }
}

export async function getTenantPaymentHistory(tenantId: string, page: number, limit: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(eq(payments.tenantId, tenantId)),
    ),
    withRetry(() =>
      db
        .select({
          id: payments.id,
          date: payments.submittedAt,
          amountExpected: payments.amountExpected,
          amountReceived: payments.amountReceived,
          mpesaCode: payments.mpesaCode,
          status: payments.status,
        })
        .from(payments)
        .where(eq(payments.tenantId, tenantId))
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
      amountExpected: toNumber(row.amountExpected),
      amountReceived: toNumber(row.amountReceived),
      mpesaCode: row.mpesaCode,
      status: row.status,
    })),
  }
}

export async function getTenantMaintenanceTickets(tenantId: string, limit = 5) {
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
      .where(eq(maintenanceTickets.tenantId, tenantId))
      .orderBy(desc(maintenanceTickets.createdAt))
      .limit(limit),
  )

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    status: row.status,
    date: row.createdAt.toISOString(),
  }))
}

export async function getTenantNotices(tenantId: string, limit = 5) {
  const rows = await withRetry(() =>
    db
      .select({
        id: notices.id,
        title: notices.title,
        message: notices.message,
        sentAt: notices.sentAt,
      })
      .from(notices)
      .where(and(eq(notices.targetType, 'tenant'), eq(notices.targetId, tenantId)))
      .orderBy(desc(notices.sentAt))
      .limit(limit),
  )

  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? 'Notice',
    message: row.message,
    date: row.sentAt.toISOString(),
  }))
}

/**
 * Creates a tenant, assigns unit, generates current-month invoice, and sends welcome SMS.
 */
export async function createTenant(data: {
  fullName: string
  phoneNumber: string
  idNumber?: string | null
  propertyId: string
  unitId: string
  moveInDate: string
  rentDueDay: number
  securityDeposit: number
}) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
  if (data.moveInDate > today) {
    throw new Error('Move-in date cannot be in the future')
  }
  const normalizedPhone = normalizePhone(data.phoneNumber)

  const [existingTenant] = await withRetry(() =>
    db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.phoneNumber, normalizedPhone))
      .limit(1),
  )
  if (existingTenant) {
    throw new Error('A tenant with this phone number already exists')
  }

  const [property] = await withRetry(() =>
    db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1),
  )
  if (!property) throw new Error('Property not found')

  const [unit] = await withRetry(() =>
    db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        unitNumber: units.unitNumber,
        monthlyRent: units.monthlyRent,
        status: units.status,
        tenantId: units.tenantId,
      })
      .from(units)
      .where(eq(units.id, data.unitId))
      .limit(1),
  )

  if (!unit || unit.propertyId !== data.propertyId) {
    throw new Error('Unit not found for selected property')
  }
  if (unit.status !== 'vacant' || unit.tenantId) {
    throw new Error('This unit is already occupied')
  }

  const [tenant] = await withRetry(() =>
    db
      .insert(tenants)
      .values({
        fullName: data.fullName,
        phoneNumber: normalizedPhone,
        idNumber: data.idNumber ?? null,
        propertyId: data.propertyId,
        unitId: data.unitId,
        moveInDate: data.moveInDate,
        rentDueDay: data.rentDueDay,
        securityDeposit: data.securityDeposit.toString(),
        status: 'active',
      })
      .returning(),
  )

  const occupiedRows = await withRetry(() =>
    db
      .update(units)
      .set({
        tenantId: tenant.id,
        status: 'occupied',
      })
      .where(and(eq(units.id, data.unitId), eq(units.status, 'vacant'), isNull(units.tenantId)))
      .returning({ id: units.id }),
  )

  if (occupiedRows.length === 0) {
    await withRetry(() => db.delete(tenants).where(eq(tenants.id, tenant.id)))
    throw new Error('This unit is already occupied')
  }

  const [invoice] = await withRetry(() =>
    db
      .insert(rentInvoices)
      .values({
        tenantId: tenant.id,
        unitId: data.unitId,
        amount: toNumber(unit.monthlyRent).toString(),
        dueDate: getMonthDueDate(data.rentDueDay),
        status: 'unpaid',
      })
      .returning({ id: rentInvoices.id }),
  )

  const payload = {
    tenant,
    propertyName: property.name,
    unitNumber: unit.unitNumber,
    monthlyRent: toNumber(unit.monthlyRent),
  }

  await sendWelcomeTenantSMS({
    phone: normalizedPhone,
    name: payload.tenant.fullName,
    propertyName: payload.propertyName,
    unitNumber: payload.unitNumber,
    rent: payload.monthlyRent,
    rentDueDay: payload.tenant.rentDueDay,
  })

  // Also send the actual invoice via SMS
  if (invoice) {
    try {
      await sendRentInvoiceSMS(invoice.id)
    } catch (e) {
      console.error('Failed to send initial SMS invoice:', e)
    }
  }

  return payload.tenant
}

export async function updateTenant(
  id: string,
  data: {
    fullName: string
    phoneNumber: string
    idNumber?: string | null
    rentDueDay: number
    securityDeposit: number
  },
) {
  const normalizedPhone = normalizePhone(data.phoneNumber)

  const [existing] = await withRetry(() =>
    db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.phoneNumber, normalizedPhone), ne(tenants.id, id)))
      .limit(1),
  )
  if (existing) {
    throw new Error('A tenant with this phone number already exists')
  }

  const [updated] = await withRetry(() =>
    db
      .update(tenants)
      .set({
        fullName: data.fullName,
        phoneNumber: normalizedPhone,
        idNumber: data.idNumber ?? null,
        rentDueDay: data.rentDueDay,
        securityDeposit: data.securityDeposit.toString(),
      })
      .where(eq(tenants.id, id))
      .returning(),
  )

  return updated
}

export async function assignUnit(tenantId: string, propertyId: string, unitId: string) {
  const [tenant] = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phoneNumber: tenants.phoneNumber,
        status: tenants.status,
        unitId: tenants.unitId,
        rentDueDay: tenants.rentDueDay,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  )
  if (!tenant) throw new Error('Tenant not found')
  if (tenant.status !== 'active') throw new Error('Only active tenants can be assigned a unit')
  if (tenant.unitId) throw new Error('This tenant is already assigned to a unit.\nMove them out first.')

  const [unit] = await withRetry(() =>
    db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        unitNumber: units.unitNumber,
        monthlyRent: units.monthlyRent,
        status: units.status,
        tenantId: units.tenantId,
      })
      .from(units)
      .where(eq(units.id, unitId))
      .limit(1),
  )
  if (!unit || unit.propertyId !== propertyId) throw new Error('Unit not found')
  if (unit.status !== 'vacant' || unit.tenantId) throw new Error('This unit is already occupied')

  const [property] = await withRetry(() =>
    db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1),
  )
  if (!property) throw new Error('Property not found')

  await withRetry(() =>
    db
      .update(tenants)
      .set({
        propertyId,
        unitId,
        status: 'active',
      })
      .where(and(eq(tenants.id, tenantId), isNull(tenants.unitId), eq(tenants.status, 'active'))),
  )

  const occupiedRows = await withRetry(() =>
    db
      .update(units)
      .set({
        tenantId: tenant.id,
        status: 'occupied',
      })
      .where(and(eq(units.id, unitId), eq(units.status, 'vacant'), isNull(units.tenantId)))
      .returning({ id: units.id }),
  )

  if (occupiedRows.length === 0) {
    await withRetry(() =>
      db
        .update(tenants)
        .set({ unitId: null })
        .where(eq(tenants.id, tenantId)),
    )
    throw new Error('This unit is already occupied')
  }

  const [invoice] = await withRetry(() =>
    db
      .insert(rentInvoices)
      .values({
        tenantId: tenant.id,
        unitId: unit.id,
        amount: toNumber(unit.monthlyRent).toString(),
        dueDate: getMonthDueDate(tenant.rentDueDay),
        status: 'unpaid',
      })
      .returning({ id: rentInvoices.id }),
  )

  const payload = { tenant, propertyName: property.name, unitNumber: unit.unitNumber }

  if (invoice) {
    try {
      await sendRentInvoiceSMS(invoice.id)
    } catch (e) {
      console.error('Failed to send SMS invoice after unit assignment:', e)
    }
  }

  return payload
}

export async function moveOutTenant(id: string, moveOutDate: string) {
  const [tenant] = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phoneNumber: tenants.phoneNumber,
        propertyId: tenants.propertyId,
        unitId: tenants.unitId,
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1),
  )
  if (!tenant) throw new Error('Tenant not found')

  const [property] = await withRetry(() =>
    db
      .select({ name: properties.name })
      .from(properties)
      .where(eq(properties.id, tenant.propertyId))
      .limit(1),
  )

  let unitNumber = 'Unknown'
  if (tenant.unitId) {
    const tenantUnitId = tenant.unitId
    const [unit] = await withRetry(() =>
      db
        .select({ id: units.id, unitNumber: units.unitNumber })
        .from(units)
        .where(eq(units.id, tenantUnitId))
        .limit(1),
    )
    if (unit) {
      unitNumber = unit.unitNumber
      await withRetry(() =>
        db
          .update(units)
          .set({ status: 'vacant', tenantId: null })
          .where(eq(units.id, unit.id)),
      )
    }
  }

  await withRetry(() =>
    db
      .update(tenants)
      .set({
        status: 'moved_out',
        moveOutDate,
        unitId: null,
      })
      .where(eq(tenants.id, id)),
  )

  // Schema has no "closed" invoice status, so we move open balances to overdue terminal state.
  await withRetry(() =>
    db
      .update(rentInvoices)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(rentInvoices.tenantId, id),
          inArray(rentInvoices.status, ['unpaid', 'partial']),
        ),
      ),
  )

  const payload = {
    tenant,
    propertyName: property?.name ?? 'Unknown property',
    unitNumber,
  }

  await sendMoveOutSMS({
    phone: payload.tenant.phoneNumber,
    name: payload.tenant.fullName,
    unitNumber: payload.unitNumber,
    propertyName: payload.propertyName,
    moveOutDate,
  })

  return payload
}

export async function removeTenant(id: string) {
  const [pendingPayment] = await withRetry(() =>
    db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, id),
          inArray(payments.status, ['unpaid', 'pending_verification', 'partial', 'overdue']),
        ),
      )
      .limit(1),
  )

  const [pendingInvoice] = await withRetry(() =>
    db
      .select({ id: rentInvoices.id })
      .from(rentInvoices)
      .where(and(eq(rentInvoices.tenantId, id), inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue'])))
      .limit(1),
  )

  if (pendingPayment || pendingInvoice) {
    throw new Error('Cannot remove a tenant with pending payments.\nResolve all payments first.')
  }

  const [updated] = await withRetry(() =>
    db
      .update(tenants)
      .set({ status: 'inactive' })
      .where(eq(tenants.id, id))
      .returning(),
  )
  return updated
}

/**
 * Returns vacant units for one property.
 */
export async function getVacantUnitsByProperty(propertyId: string): Promise<
  Array<{ id: string; unitNumber: string; monthlyRent: number }>
> {
  const rows = await withRetry(() =>
    db
      .select({
        id: units.id,
        unitNumber: units.unitNumber,
        monthlyRent: units.monthlyRent,
      })
      .from(units)
      .where(and(eq(units.propertyId, propertyId), eq(units.status, 'vacant'), sql`${units.tenantId} is null`))
      .orderBy(units.unitNumber),
  )

  return rows.map((row) => ({
    id: row.id,
    unitNumber: row.unitNumber,
    monthlyRent: toNumber(row.monthlyRent),
  }))
}

export async function tenantBelongsToLandlord(tenantId: string, landlordId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: tenants.id })
      .from(tenants)
      .innerJoin(properties, eq(tenants.propertyId, properties.id))
      .where(and(eq(tenants.id, tenantId), eq(properties.ownerId, landlordId)))
      .limit(1),
  )

  return Boolean(row)
}

export async function tenantAccessibleToCaretaker(tenantId: string, caretakerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ id: tenants.id })
      .from(tenants)
      .innerJoin(caretakerProperties, eq(tenants.propertyId, caretakerProperties.propertyId))
      .where(and(eq(tenants.id, tenantId), eq(caretakerProperties.caretakerId, caretakerId)))
      .limit(1),
  )
  return Boolean(row)
}

export async function logTenantActivity(actorId: string, action: string, tenantId: string, metadata?: unknown) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId,
      action,
      entityType: 'tenant',
      entityId: tenantId,
      metadata: metadata as any,
    }),
  )
}

/**
 * Offsets a tenant's debt using their security deposit.
 */
export async function applyDepositToDebt(tenantId: string, actorId: string) {
  const [tenant] = await withRetry(() =>
    db
      .select({ id: tenants.id, securityDeposit: tenants.securityDeposit })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  )
  if (!tenant) throw new Error('Tenant not found')

  const deposit = toNumber(tenant.securityDeposit)
  if (deposit <= 0) throw new Error('No security deposit available')

  const unpaidInvoices = await withRetry(() =>
    db
      .select({ id: rentInvoices.id, amount: rentInvoices.amount, unitId: rentInvoices.unitId })
      .from(rentInvoices)
      .where(
        and(
          eq(rentInvoices.tenantId, tenantId),
          inArray(rentInvoices.status, ['unpaid', 'partial', 'overdue']),
        ),
      )
      .orderBy(rentInvoices.dueDate),
  )

  if (unpaidInvoices.length === 0) throw new Error('No outstanding debt found')

  let remainingDeposit = deposit
  let totalApplied = 0
  const updatedInvoiceIds: string[] = []
  const targetUnitId = unpaidInvoices[0].unitId

  for (const invoice of unpaidInvoices) {
    const amount = toNumber(invoice.amount)
    if (remainingDeposit >= amount) {
      remainingDeposit -= amount
      totalApplied += amount
      updatedInvoiceIds.push(invoice.id)
    } else {
      // Partially pay the invoice
      const newAmount = (amount - remainingDeposit).toString()
      totalApplied += remainingDeposit
      await withRetry(() =>
        db
          .update(rentInvoices)
          .set({
            amount: newAmount,
            status: 'partial',
          })
          .where(eq(rentInvoices.id, invoice.id)),
      )
      remainingDeposit = 0
      break
    }
  }

  if (updatedInvoiceIds.length > 0) {
    await withRetry(() =>
      db
        .update(rentInvoices)
        .set({ status: 'paid' })
        .where(inArray(rentInvoices.id, updatedInvoiceIds)),
    )
  }

  // Record the offset as a verified payment so stats update
  if (totalApplied > 0) {
    await withRetry(() =>
      db.insert(payments).values({
        tenantId,
        unitId: targetUnitId,
        amountExpected: totalApplied.toString(),
        amountReceived: totalApplied.toString(),
        status: 'paid',
        notes: 'Security Deposit Offset',
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: actorId,
      }),
    )
  }

  await withRetry(() =>
    db
      .update(tenants)
      .set({ securityDeposit: remainingDeposit.toString() })
      .where(eq(tenants.id, tenantId)),
  )

  await logTenantActivity(actorId, 'apply_deposit_to_debt', tenantId, {
    originalDeposit: deposit,
    remainingDeposit,
    clearedInvoices: updatedInvoiceIds.length,
  })

  return { remainingDeposit, clearedInvoices: updatedInvoiceIds.length }
}

/**
 * Writes off an uncollectible invoice.
 */
export async function writeOffInvoice(invoiceId: string, tenantId: string, actorId: string) {
  const [updated] = await withRetry(() =>
    db
      .update(rentInvoices)
      .set({ status: 'written_off' })
      .where(and(eq(rentInvoices.id, invoiceId), eq(rentInvoices.tenantId, tenantId)))
      .returning(),
  )

  if (!updated) throw new Error('Invoice not found')

  await logTenantActivity(actorId, 'write_off_invoice', tenantId, {
    invoiceId,
    amount: updated.amount,
  })

  return updated
}

export async function getTenantInvoices(tenantId: string) {
  return withRetry(() =>
    db
      .select({
        id: rentInvoices.id,
        amount: rentInvoices.amount,
        dueDate: rentInvoices.dueDate,
        status: rentInvoices.status,
        createdAt: rentInvoices.createdAt,
      })
      .from(rentInvoices)
      .where(eq(rentInvoices.tenantId, tenantId))
      .orderBy(desc(rentInvoices.dueDate)),
  )
}
