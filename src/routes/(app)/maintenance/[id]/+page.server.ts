import { and, eq } from 'drizzle-orm'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  addComment,
  assignTicket,
  getComments,
  getTicketById,
  reopenTicket,
  unassignTicket,
  updateTicketStatus,
} from '$lib/services/maintenance'
import { withRetry } from '$lib/db/retry'
import { activityLogs, caretakerProperties, properties, users } from '$lib/db/schema'
import { db } from '$lib/server/db'

function canCaretakerTransition(current: string, next: string) {
  return (current === 'open' && next === 'in_progress') || (current === 'in_progress' && next === 'resolved')
}

async function hasPropertyAccess(userId: string, role: 'landlord' | 'caretaker', propertyId: string) {
  if (role === 'landlord') {
    const [row] = await withRetry(() =>
      db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.ownerId, userId)))
        .limit(1),
    )

    return Boolean(row)
  }

  const [row] = await withRetry(() =>
    db
      .select({ id: caretakerProperties.id })
      .from(caretakerProperties)
      .where(
        and(
          eq(caretakerProperties.propertyId, propertyId),
          eq(caretakerProperties.caretakerId, userId),
        ),
      )
      .limit(1),
  )

  return Boolean(row)
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const id = event.params.id
  if (!id) throw redirect(302, '/maintenance')

  const ticket = await getTicketById(id)
  if (!ticket) throw redirect(302, '/maintenance')

  const accessByProperty = await hasPropertyAccess(session.userId, session.role, ticket.propertyId)
  const hasAccess = accessByProperty || (session.role === 'caretaker' && ticket.assignedTo === session.userId)

  if (!hasAccess) {
    throw redirect(302, '/maintenance')
  }

  const comments = await getComments(id)

  const [ownerRow] = await withRetry(() =>
    db
      .select({ ownerId: properties.ownerId })
      .from(properties)
      .where(eq(properties.id, ticket.propertyId))
      .limit(1),
  )

  const landlordId = ownerRow?.ownerId

  const caretakers = landlordId
    ? await withRetry(() =>
        db
          .select({
            id: users.id,
            name: users.name,
            phone: users.phone,
          })
          .from(users)
          .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId))),
      )
    : []

  return {
    ticket,
    comments,
    caretakers,
    user: session,
  }
}

export const actions: Actions = {
  updateStatus: async (event) => {
    const session = await requireAuth(event)
    const form = await event.request.formData()

    const id = form.get('id')?.toString().trim() ?? ''
    const status = form.get('status')?.toString().trim() ?? ''

    if (!id || !status) {
      return fail(400, { message: 'Ticket id and status are required' })
    }

    if (status !== 'open' && status !== 'in_progress' && status !== 'resolved' && status !== 'closed') {
      return fail(400, { message: 'Invalid status' })
    }

    const ticket = await getTicketById(id)
    if (!ticket) {
      return fail(404, { message: 'Ticket not found' })
    }

    const accessByProperty = await hasPropertyAccess(session.userId, session.role, ticket.propertyId)
    const hasAccess = accessByProperty || (session.role === 'caretaker' && ticket.assignedTo === session.userId)
    if (!hasAccess) {
      return fail(403, { message: 'Forbidden' })
    }

    if (ticket.status === 'closed' && status !== 'open') {
      return fail(400, { message: 'This ticket is closed. Reopen it first to make changes.' })
    }

    if (session.role === 'caretaker' && !canCaretakerTransition(ticket.status, status)) {
      return fail(403, { message: 'Caretakers can only move tickets to In Progress and Resolved.' })
    }

    if (session.role === 'caretaker' && status === 'closed') {
      return fail(403, { message: 'Only landlords can close tickets' })
    }

    try {
      await updateTicketStatus(id, status, session.userId)
      return { success: true }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to update status',
      })
    }
  },

  assignCaretaker: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can assign caretakers' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    const caretakerId = form.get('caretakerId')?.toString().trim() ?? ''

    if (!id || !caretakerId) {
      return fail(400, { message: 'Ticket id and caretaker are required' })
    }

    const ticket = await getTicketById(id)
    if (!ticket) return fail(404, { message: 'Ticket not found' })

    if (ticket.propertyOwnerId !== session.userId) {
      return fail(403, { message: 'Forbidden' })
    }

    const [caretaker] = await withRetry(() =>
      db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, caretakerId), eq(users.role, 'caretaker'), eq(users.invitedBy, session.userId)))
        .limit(1),
    )

    if (!caretaker) {
      return fail(400, { message: 'Caretaker must belong to this landlord' })
    }

    await assignTicket(id, caretakerId)

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'ticket_assigned',
        entityType: 'maintenance_ticket',
        entityId: id,
        metadata: { caretakerId },
      }),
    )

    return { success: true }
  },

  unassignCaretaker: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can unassign caretakers' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) return fail(400, { message: 'Ticket id is required' })

    const ticket = await getTicketById(id)
    if (!ticket) return fail(404, { message: 'Ticket not found' })
    if (ticket.propertyOwnerId !== session.userId) return fail(403, { message: 'Forbidden' })

    await unassignTicket(id)

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'ticket_unassigned',
        entityType: 'maintenance_ticket',
        entityId: id,
      }),
    )

    return { success: true }
  },

  reopenTicket: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can reopen tickets' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) return fail(400, { message: 'Ticket id is required' })

    const ticket = await getTicketById(id)
    if (!ticket) return fail(404, { message: 'Ticket not found' })
    if (ticket.propertyOwnerId !== session.userId) return fail(403, { message: 'Forbidden' })

    await reopenTicket(id)

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'ticket_reopened',
        entityType: 'maintenance_ticket',
        entityId: id,
      }),
    )

    return { success: true }
  },

  addComment: async (event) => {
    const session = await requireAuth(event)
    const form = await event.request.formData()

    const id = form.get('id')?.toString().trim() ?? ''
    const message = form.get('message')?.toString().trim() ?? ''

    if (!id || !message || message.length < 2) {
      return fail(400, { message: 'Message must be at least 2 characters' })
    }

    const ticket = await getTicketById(id)
    if (!ticket) return fail(404, { message: 'Ticket not found' })

    const accessByProperty = await hasPropertyAccess(session.userId, session.role, ticket.propertyId)
    const hasAccess = accessByProperty || (session.role === 'caretaker' && ticket.assignedTo === session.userId)

    if (!hasAccess) {
      return fail(403, { message: 'Forbidden' })
    }

    if (ticket.status === 'closed') {
      return fail(400, { message: 'Closed tickets are read-only' })
    }

    await addComment(id, session.userId, message)

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'ticket_comment_added',
        entityType: 'maintenance_ticket',
        entityId: id,
      }),
    )

    return { success: true }
  },
}
