import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  maintenanceTickets,
  properties,
  settings,
  tenants,
  ticketComments,
  units,
  users,
} from '$lib/db/schema'
import { db } from '$lib/server/db'
import { normalizePhone } from '$lib/server/auth'
import {
  sendSMSReportReplySMS,
  sendTicketAssignedSMS,
  sendTicketCreatedSMS,
  sendTicketStatusUpdateSMS,
} from '$lib/server/notifications'
import type { TicketCategory, TicketComment, TicketStatus, TicketWithDetails } from '$lib/types/maintenance'

export type RecentTicketItem = {
  id: string
  unitNumber: string
  category: string
  status: TicketStatus
  date: string
}

type TicketFilters = {
  propertyId?: string | null
  status?: TicketStatus | 'all' | null
  category?: TicketCategory | 'all' | null
  unitId?: string | null
  tenantId?: string | null
}

type TicketRow = {
  id: string
  propertyId: string
  propertyName: string
  propertyOwnerId: string
  unitId: string
  unitNumber: string
  tenantId: string | null
  tenantName: string | null
  tenantPhone: string | null
  category: TicketCategory
  description: string
  status: TicketStatus
  assignedTo: string | null
  assignedToName: string | null
  createdViaSMS: boolean
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
}

function shortTicketId(id: string): string {
  return id.replaceAll('-', '').slice(0, 6).toUpperCase()
}

function mapTicketRow(row: TicketRow): TicketWithDetails & { propertyOwnerId: string } {
  return {
    id: row.id,
    shortId: shortTicketId(row.id),
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    unitId: row.unitId,
    unitNumber: row.unitNumber,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantPhone: row.tenantPhone,
    category: row.category,
    description: row.description,
    status: row.status,
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    createdViasSMS: row.createdViaSMS,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    propertyOwnerId: row.propertyOwnerId,
  }
}

function baseTicketSelect() {
  return {
    id: maintenanceTickets.id,
    propertyId: maintenanceTickets.propertyId,
    propertyName: properties.name,
    propertyOwnerId: properties.ownerId,
    unitId: maintenanceTickets.unitId,
    unitNumber: units.unitNumber,
    tenantId: maintenanceTickets.tenantId,
    tenantName: tenants.fullName,
    tenantPhone: tenants.phoneNumber,
    category: maintenanceTickets.category,
    description: maintenanceTickets.description,
    status: maintenanceTickets.status,
    assignedTo: maintenanceTickets.assignedTo,
    assignedToName: users.name,
    createdViaSMS: sql<boolean>`exists(
      select 1
      from ${activityLogs}
      where ${activityLogs.entityType} = 'maintenance_ticket'
        and ${activityLogs.entityId} = ${maintenanceTickets.id}
        and ${activityLogs.action} = 'ticket_created_via_sms'
    )`,
    createdAt: maintenanceTickets.createdAt,
    updatedAt: maintenanceTickets.updatedAt,
    resolvedAt: maintenanceTickets.resolvedAt,
  }
}

function normalizeStatusFilter(status?: TicketStatus | 'all' | null): TicketStatus | 'all' {
  if (!status || status === 'all') return 'all'
  if (status === 'open' || status === 'in_progress' || status === 'resolved' || status === 'closed') {
    return status
  }
  return 'all'
}

function normalizeCategoryFilter(category?: TicketCategory | 'all' | null): TicketCategory | 'all' {
  if (!category || category === 'all') return 'all'
  if (
    category === 'water' ||
    category === 'electricity' ||
    category === 'plumbing' ||
    category === 'security' ||
    category === 'other'
  ) {
    return category
  }
  return 'all'
}

function buildTicketFilters(filters: TicketFilters): any[] {
  const clauses: any[] = []

  if (filters.propertyId) clauses.push(eq(maintenanceTickets.propertyId, filters.propertyId))
  if (filters.unitId) clauses.push(eq(maintenanceTickets.unitId, filters.unitId))
  if (filters.tenantId) clauses.push(eq(maintenanceTickets.tenantId, filters.tenantId))

  const status = normalizeStatusFilter(filters.status)
  if (status !== 'all') clauses.push(eq(maintenanceTickets.status, status))

  const category = normalizeCategoryFilter(filters.category)
  if (category !== 'all') clauses.push(eq(maintenanceTickets.category, category))

  return clauses
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

async function getLandlordPropertyIds(landlordId: string): Promise<string[]> {
  const rows = await withRetry(() =>
    db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.ownerId, landlordId)),
  )

  return rows.map((row) => row.id)
}

async function getCaretakerPropertyIds(caretakerId: string): Promise<string[]> {
  const rows = await withRetry(() =>
    db
      .select({ id: caretakerProperties.propertyId })
      .from(caretakerProperties)
      .where(eq(caretakerProperties.caretakerId, caretakerId)),
  )

  return rows.map((row) => row.id)
}

async function getTicketForOps(id: string) {
  const [ticket] = await withRetry(() =>
    db
      .select(baseTicketSelect())
      .from(maintenanceTickets)
      .innerJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
      .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
      .leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id))
      .leftJoin(users, eq(maintenanceTickets.assignedTo, users.id))
      .where(eq(maintenanceTickets.id, id))
      .limit(1),
  )

  return ticket ? mapTicketRow(ticket as TicketRow) : null
}

async function shouldNotifyTicketStatus(ownerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ enabled: settings.notifyTicketStatus })
      .from(settings)
      .where(eq(settings.userId, ownerId))
      .limit(1),
  )
  return row?.enabled ?? true
}

async function shouldNotifyTicketAssigned(ownerId: string): Promise<boolean> {
  const [row] = await withRetry(() =>
    db
      .select({ enabled: settings.notifyTicketAssigned })
      .from(settings)
      .where(eq(settings.userId, ownerId))
      .limit(1),
  )
  return row?.enabled ?? true
}

async function logTicketActivity(input: {
  actorId: string | null
  action: string
  ticketId: string
  metadata?: Record<string, unknown>
}) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId: input.actorId,
      action: input.action,
      entityType: 'maintenance_ticket',
      entityId: input.ticketId,
      metadata: input.metadata ?? null,
    }),
  )
}

async function getActiveTenantForUnit(unitId: string) {
  const [tenant] = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phoneNumber: tenants.phoneNumber,
      })
      .from(tenants)
      .where(and(eq(tenants.unitId, unitId), eq(tenants.status, 'active')))
      .limit(1),
  )

  return tenant ?? null
}

/**
 * Returns last N maintenance tickets scoped to current user properties.
 */
export async function getRecentTickets(userId: string, limit: number): Promise<RecentTicketItem[]> {
  const scope = await getUserScope(userId)
  if (!scope) return []

  const propertyIds =
    scope.role === 'landlord'
      ? await getLandlordPropertyIds(userId)
      : await getCaretakerPropertyIds(userId)

  if (propertyIds.length === 0) return []

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
      .where(inArray(maintenanceTickets.propertyId, propertyIds))
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

export async function getTicketStats(userId: string, months = 6): Promise<{
  openTicketsCount: number
  monthlyTickets: number[]
}> {
  const scope = await getUserScope(userId)
  if (!scope) {
    return {
      openTicketsCount: 0,
      monthlyTickets: Array(months).fill(0),
    }
  }

  const propertyIds =
    scope.role === 'landlord'
      ? await getLandlordPropertyIds(userId)
      : await getCaretakerPropertyIds(userId)

  if (propertyIds.length === 0) {
    return {
      openTicketsCount: 0,
      monthlyTickets: Array(months).fill(0),
    }
  }

  const [openRow] = await withRetry(() =>
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(maintenanceTickets)
      .where(and(inArray(maintenanceTickets.propertyId, propertyIds), eq(maintenanceTickets.status, 'open'))),
  )

  const endMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - (months - 1), 1)
  const nextMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1)

  const monthlyRows = await withRetry(() =>
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${maintenanceTickets.createdAt}), 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(maintenanceTickets)
      .where(
        and(
          inArray(maintenanceTickets.propertyId, propertyIds),
          sql`${maintenanceTickets.createdAt} >= ${startMonth}`,
          sql`${maintenanceTickets.createdAt} < ${nextMonth}`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${maintenanceTickets.createdAt})`),
  )

  const countMap = new Map(monthlyRows.map((row) => [row.month, row.count]))
  const monthlyTickets = Array.from({ length: months }, (_, index) => {
    const month = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1)
    return countMap.get(month.toISOString().slice(0, 7)) ?? 0
  })

  return {
    openTicketsCount: openRow?.count ?? 0,
    monthlyTickets,
  }
}

export async function getTicketsByLandlord(
  landlordId: string,
  page: number,
  limit: number,
  filters: TicketFilters,
): Promise<{ tickets: TicketWithDetails[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const propertyIds = await getLandlordPropertyIds(landlordId)
  if (propertyIds.length === 0) return { tickets: [], totalCount: 0 }

  const whereClauses = [inArray(maintenanceTickets.propertyId, propertyIds), ...buildTicketFilters(filters)]

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(baseTicketSelect())
        .from(maintenanceTickets)
        .innerJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
        .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
        .leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id))
        .leftJoin(users, eq(maintenanceTickets.assignedTo, users.id))
        .where(and(...whereClauses))
        .orderBy(desc(maintenanceTickets.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    tickets: rows.map((row) => mapTicketRow(row as TicketRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

export async function getTicketsByCaretaker(
  caretakerId: string,
  page: number,
  limit: number,
  filters: TicketFilters,
): Promise<{ tickets: TicketWithDetails[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const propertyIds = await getCaretakerPropertyIds(caretakerId)
  if (propertyIds.length === 0 && !filters.propertyId) {
    const directWhere = and(eq(maintenanceTickets.assignedTo, caretakerId), ...buildTicketFilters(filters))

    const [countRows, rows] = await Promise.all([
      withRetry(() =>
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(maintenanceTickets)
          .where(directWhere),
      ),
      withRetry(() =>
        db
          .select(baseTicketSelect())
          .from(maintenanceTickets)
          .innerJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
          .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
          .leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id))
          .leftJoin(users, eq(maintenanceTickets.assignedTo, users.id))
          .where(directWhere)
          .orderBy(desc(maintenanceTickets.createdAt))
          .limit(safeLimit)
          .offset(offset),
      ),
    ])

    return {
      tickets: rows.map((row) => mapTicketRow(row as TicketRow)),
      totalCount: countRows[0]?.count ?? 0,
    }
  }

  const accessClause =
    propertyIds.length > 0
      ? or(
          inArray(maintenanceTickets.propertyId, propertyIds),
          eq(maintenanceTickets.assignedTo, caretakerId),
        )
      : eq(maintenanceTickets.assignedTo, caretakerId)

  const whereClauses = [accessClause, ...buildTicketFilters(filters)]

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenanceTickets)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select(baseTicketSelect())
        .from(maintenanceTickets)
        .innerJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
        .innerJoin(units, eq(maintenanceTickets.unitId, units.id))
        .leftJoin(tenants, eq(maintenanceTickets.tenantId, tenants.id))
        .leftJoin(users, eq(maintenanceTickets.assignedTo, users.id))
        .where(and(...whereClauses))
        .orderBy(desc(maintenanceTickets.createdAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  return {
    tickets: rows.map((row) => mapTicketRow(row as TicketRow)),
    totalCount: countRows[0]?.count ?? 0,
  }
}

export async function getTicketById(
  id: string,
): Promise<(TicketWithDetails & { propertyOwnerId: string }) | null> {
  return getTicketForOps(id)
}

export async function createTicket(
  data: {
    propertyId: string
    unitId: string
    tenantId?: string | null
    category: TicketCategory
    description: string
    assignedTo?: string | null
    internalNote?: string | null
  },
  createdBy: string,
): Promise<TicketWithDetails> {
  const [unitRow] = await withRetry(() =>
    db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        propertyOwnerId: properties.ownerId,
        unitNumber: units.unitNumber,
        tenantId: units.tenantId,
        propertyName: properties.name,
      })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(and(eq(units.id, data.unitId), eq(units.propertyId, data.propertyId)))
      .limit(1),
  )

  if (!unitRow) {
    throw new Error('Unit not found for the selected property')
  }

  const ticketTenantId = data.tenantId ?? unitRow.tenantId ?? null

  const [created] = await withRetry(() =>
    db
      .insert(maintenanceTickets)
      .values({
        propertyId: data.propertyId,
        unitId: data.unitId,
        tenantId: ticketTenantId,
        category: data.category,
        description: data.description,
        status: 'open',
        assignedTo: data.assignedTo ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: maintenanceTickets.id }),
  )

  if (!created) {
    throw new Error('Failed to create ticket')
  }

  if (data.internalNote && data.internalNote.trim().length >= 2) {
    await withRetry(() =>
      db.insert(ticketComments).values({
        ticketId: created.id,
        authorId: createdBy,
        message: data.internalNote!.trim(),
      }),
    )
  }

  await logTicketActivity({
    actorId: createdBy,
    action: 'ticket_created',
    ticketId: created.id,
    metadata: {
      category: data.category,
      unitId: data.unitId,
      propertyId: data.propertyId,
    },
  })

  const [tenantRow, assigneeRow] = await Promise.all([
    ticketTenantId
      ? withRetry(() =>
          db
            .select({
              id: tenants.id,
              fullName: tenants.fullName,
              phoneNumber: tenants.phoneNumber,
            })
            .from(tenants)
            .where(eq(tenants.id, ticketTenantId))
            .limit(1),
        ).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    data.assignedTo
      ? withRetry(() =>
          db
            .select({ id: users.id, name: users.name, phone: users.phone })
            .from(users)
            .where(and(eq(users.id, data.assignedTo!), eq(users.role, 'caretaker')))
            .limit(1),
        ).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])

  if (tenantRow) {
    try {
      await sendTicketCreatedSMS(
        {
          fullName: tenantRow.fullName,
          phoneNumber: tenantRow.phoneNumber,
        },
        {
          id: unitRow.id,
          unitNumber: unitRow.unitNumber,
        },
        data.category,
        shortTicketId(created.id),
      )
    } catch {
      // Ticket creation succeeds even if SMS delivery fails.
    }
  }

  const notifyTicketAssigned = await shouldNotifyTicketAssigned(unitRow.propertyOwnerId)

  if (assigneeRow && notifyTicketAssigned) {
    try {
      await sendTicketAssignedSMS(
        {
          name: assigneeRow.name,
          phone: assigneeRow.phone,
        },
        {
          unitNumber: unitRow.unitNumber,
        },
        {
          name: unitRow.propertyName,
        },
        {
          category: data.category,
          description: data.description,
        },
      )
    } catch {
      // Assignment SMS failures do not block ticket creation.
    }
  }

  const ticket = await getTicketForOps(created.id)
  if (!ticket) throw new Error('Ticket created but could not be loaded')

  return ticket
}

export async function updateTicketStatus(
  id: string,
  newStatus: TicketStatus,
  updatedBy: string,
): Promise<TicketWithDetails> {
  const [actor] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, updatedBy))
      .limit(1),
  )

  if (!actor) throw new Error('User not found')

  const current = await getTicketForOps(id)
  if (!current) throw new Error('Ticket not found')

  if (current.status === 'closed' && newStatus !== 'open') {
    throw new Error('This ticket is closed. Reopen it first to make changes.')
  }

  if (actor.role === 'caretaker') {
    const canMoveToInProgress = current.status === 'open' && newStatus === 'in_progress'
    const canMoveToResolved = current.status === 'in_progress' && newStatus === 'resolved'
    if (!canMoveToInProgress && !canMoveToResolved) {
      throw new Error('Caretakers can only move tickets to In Progress or Resolved in sequence.')
    }
  }

  const resolvedAt =
    newStatus === 'resolved' || newStatus === 'closed' ? new Date() : current.resolvedAt

  await withRetry(() =>
    db
      .update(maintenanceTickets)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        resolvedAt,
      })
      .where(eq(maintenanceTickets.id, id)),
  )

  await logTicketActivity({
    actorId: updatedBy,
    action: 'ticket_status_updated',
    ticketId: id,
    metadata: {
      from: current.status,
      to: newStatus,
    },
  })

  const updated = await getTicketForOps(id)
  if (!updated) throw new Error('Ticket update failed')

  const notifyTicketStatus = await shouldNotifyTicketStatus(updated.propertyOwnerId)

  if (
    notifyTicketStatus &&
    (newStatus === 'in_progress' || newStatus === 'resolved' || newStatus === 'closed') &&
    updated.tenantId &&
    updated.tenantPhone
  ) {
    try {
      await sendTicketStatusUpdateSMS(
        {
          fullName: updated.tenantName ?? 'Tenant',
          phoneNumber: updated.tenantPhone,
        },
        {
          unitNumber: updated.unitNumber,
        },
        {
          category: updated.category,
          shortId: updated.shortId,
        },
        newStatus,
      )
    } catch {
      // Status updates should still succeed when SMS fails.
    }
  }

  return updated
}

export async function assignTicket(id: string, caretakerId: string): Promise<void> {
  const [caretaker] = await withRetry(() =>
    db
      .select({ id: users.id, name: users.name, phone: users.phone, role: users.role })
      .from(users)
      .where(eq(users.id, caretakerId))
      .limit(1),
  )

  if (!caretaker || caretaker.role !== 'caretaker') {
    throw new Error('Caretaker not found')
  }

  await withRetry(() =>
    db
      .update(maintenanceTickets)
      .set({ assignedTo: caretakerId, updatedAt: new Date() })
      .where(eq(maintenanceTickets.id, id)),
  )

  const ticket = await getTicketForOps(id)
  if (!ticket) throw new Error('Ticket not found')

  await logTicketActivity({
    actorId: null,
    action: 'ticket_assigned',
    ticketId: id,
    metadata: { caretakerId },
  })

  const [propertyRow] = await withRetry(() =>
    db
      .select({ name: properties.name })
      .from(properties)
      .where(eq(properties.id, ticket.propertyId))
      .limit(1),
  )

  const notifyTicketAssigned = await shouldNotifyTicketAssigned(ticket.propertyOwnerId)

  if (notifyTicketAssigned) {
    try {
      await sendTicketAssignedSMS(
        {
          name: caretaker.name,
          phone: caretaker.phone,
        },
        {
          unitNumber: ticket.unitNumber,
        },
        {
          name: propertyRow?.name ?? ticket.propertyName,
        },
        {
          category: ticket.category,
          description: ticket.description,
        },
      )
    } catch {
      // Assignment remains successful even if SMS fails.
    }
  }
}

export async function unassignTicket(id: string): Promise<void> {
  await withRetry(() =>
    db
      .update(maintenanceTickets)
      .set({ assignedTo: null, updatedAt: new Date() })
      .where(eq(maintenanceTickets.id, id)),
  )
}

export async function reopenTicket(id: string): Promise<void> {
  await withRetry(() =>
    db
      .update(maintenanceTickets)
      .set({
        status: 'open',
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceTickets.id, id)),
  )
}

export async function addComment(
  ticketId: string,
  authorId: string,
  message: string,
): Promise<TicketComment> {
  const [comment] = await withRetry(() =>
    db
      .insert(ticketComments)
      .values({
        ticketId,
        authorId,
        message: message.trim(),
      })
      .returning({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        authorId: ticketComments.authorId,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
      }),
  )

  const [author] = await withRetry(() =>
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, comment.authorId))
      .limit(1),
  )

  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    authorName: author?.name ?? 'Unknown',
    authorRole: author?.role ?? 'user',
    message: comment.message,
    createdAt: comment.createdAt,
  }
}

export async function getComments(ticketId: string): Promise<TicketComment[]> {
  const rows = await withRetry(() =>
    db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        authorId: ticketComments.authorId,
        authorName: users.name,
        authorRole: users.role,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
      })
      .from(ticketComments)
      .innerJoin(users, eq(ticketComments.authorId, users.id))
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(ticketComments.createdAt),
  )

  return rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    message: row.message,
    createdAt: row.createdAt,
  }))
}

export async function handleSMSReport(
  fromPhone: string,
  unitNumber: string,
  description: string,
): Promise<{ success: boolean; message: string; ticketId?: string }> {
  const normalizedPhone = (() => {
    try {
      return normalizePhone(fromPhone)
    } catch {
      return fromPhone.trim()
    }
  })()

  const [unitRow] = await withRetry(() =>
    db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        unitNumber: units.unitNumber,
      })
      .from(units)
      .where(ilike(units.unitNumber, unitNumber.trim()))
      .limit(1),
  )

  if (!unitRow) {
    return {
      success: false,
      message: `Sorry, we could not find Unit ${unitNumber}. Please check the unit number and try again.`,
    }
  }

  const [tenantRow] = await withRetry(() =>
    db
      .select({
        id: tenants.id,
        fullName: tenants.fullName,
        phoneNumber: tenants.phoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.phoneNumber, normalizedPhone))
      .limit(1),
  )

  const [created] = await withRetry(() =>
    db
      .insert(maintenanceTickets)
      .values({
        propertyId: unitRow.propertyId,
        unitId: unitRow.id,
        tenantId: tenantRow?.id ?? null,
        category: 'other',
        description: description.trim(),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: maintenanceTickets.id }),
  )

  await logTicketActivity({
    actorId: null,
    action: 'ticket_created_via_sms',
    ticketId: created.id,
    metadata: {
      fromPhone: normalizedPhone,
      unitNumber: unitRow.unitNumber,
    },
  })

  const shortId = shortTicketId(created.id)

  if (!tenantRow) {
    const message = `Your issue has been logged for Unit ${unitRow.unitNumber}. Reference: TKT-${shortId}. Our team will assist shortly.`
    try {
      await sendSMSReportReplySMS(normalizedPhone, unitRow.unitNumber, shortId, message)
    } catch {
      // Ticket should still be created even if reply SMS fails.
    }

    return {
      success: true,
      message,
      ticketId: created.id,
    }
  }

  const message = `Your issue for Unit ${unitRow.unitNumber} has been logged. Reference: TKT-${shortId}. Our team will assist shortly. Thank you.`
  try {
    await sendSMSReportReplySMS(normalizedPhone, unitRow.unitNumber, shortId, message)
  } catch {
    // Ticket should still be created even if reply SMS fails.
  }

  return {
    success: true,
    message,
    ticketId: created.id,
  }
}
