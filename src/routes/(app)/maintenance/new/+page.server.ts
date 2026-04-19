import { and, eq, inArray } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { withRetry } from '$lib/db/retry'
import { caretakerProperties, properties, users } from '$lib/db/schema'
import { db } from '$lib/server/db'
import { createTicket } from '$lib/services/maintenance'
import { getPropertyUnits } from '$lib/services/properties'
import type { TicketCategory } from '$lib/types/maintenance'

async function getLandlordId(userId: string): Promise<string | null> {
  const [row] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )

  if (!row) return null
  if (row.role === 'landlord') return row.id
  return row.invitedBy
}

async function getAccessibleProperties(userId: string) {
  const [scope] = await withRetry(() =>
    db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )

  if (!scope) return []

  if (scope.role === 'landlord') {
    return withRetry(() =>
      db
        .select({ id: properties.id, name: properties.name, ownerId: properties.ownerId })
        .from(properties)
        .where(eq(properties.ownerId, userId))
        .orderBy(properties.name),
    )
  }

  return withRetry(() =>
    db
      .select({ id: properties.id, name: properties.name, ownerId: properties.ownerId })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(eq(caretakerProperties.caretakerId, userId))
      .orderBy(properties.name),
  )
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const [landlordId, propertyRows] = await Promise.all([
    getLandlordId(session.userId),
    getAccessibleProperties(session.userId),
  ])

  if (!landlordId) {
    throw redirect(302, '/maintenance')
  }

  const propertyIds = propertyRows.map((row) => row.id)

  const unitsByPropertyEntries = await Promise.all(
    propertyRows.map(async (property) => {
      const units = await getPropertyUnits(property.id)
      return [property.id, units] as const
    }),
  )

  const unitsByProperty = Object.fromEntries(unitsByPropertyEntries)

  const caretakerRows = await withRetry(() =>
    db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId))),
  )

  const caretakerIds = caretakerRows.map((row) => row.id)

  const caretakerAssignments = caretakerIds.length && propertyIds.length
    ? await withRetry(() =>
        db
          .select({
            caretakerId: caretakerProperties.caretakerId,
            propertyId: caretakerProperties.propertyId,
          })
          .from(caretakerProperties)
          .where(
            and(
              inArray(caretakerProperties.caretakerId, caretakerIds),
              inArray(caretakerProperties.propertyId, propertyIds),
            ),
          ),
      )
    : []

  const assignmentMap = new Map<string, string[]>()
  for (const row of caretakerAssignments) {
    const list = assignmentMap.get(row.caretakerId) ?? []
    list.push(row.propertyId)
    assignmentMap.set(row.caretakerId, list)
  }

  const caretakers = caretakerRows.map((row) => ({
    ...row,
    propertyIds: assignmentMap.get(row.id) ?? [],
  }))

  return {
    properties: propertyRows,
    unitsByProperty,
    caretakers,
    senderId: env.TIARA_SENDER_ID ?? 'your sender ID',
    user: session,
  }
}

export const actions: Actions = {
  createTicket: async (event) => {
    const session = await requireAuth(event)
    const form = await event.request.formData()

    const propertyId = form.get('property_id')?.toString().trim() ?? ''
    const unitId = form.get('unit_id')?.toString().trim() ?? ''
    const category = form.get('category')?.toString().trim() ?? ''
    const description = form.get('description')?.toString().trim() ?? ''
    const assignedTo = form.get('assigned_to')?.toString().trim() ?? ''
    const internalNote = form.get('internal_note')?.toString().trim() ?? ''

    const errors: Record<string, string> = {}
    if (!propertyId) errors.property_id = 'Property is required'
    if (!unitId) errors.unit_id = 'Unit is required'
    if (!category) errors.category = 'Category is required'
    if (
      category &&
      category !== 'water' &&
      category !== 'electricity' &&
      category !== 'plumbing' &&
      category !== 'security' &&
      category !== 'other'
    ) {
      errors.category = 'Invalid category selected'
    }
    if (!description || description.length < 10) {
      errors.description = 'Description must be at least 10 characters'
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const [scope] = await withRetry(() =>
      db
        .select({ role: users.role, invitedBy: users.invitedBy })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1),
    )

    if (!scope) {
      return fail(403, { message: 'Unauthorized' })
    }

    const allowedProperty =
      scope.role === 'landlord'
        ? await withRetry(() =>
            db
              .select({ id: properties.id })
              .from(properties)
              .where(and(eq(properties.id, propertyId), eq(properties.ownerId, session.userId)))
              .limit(1),
          ).then((rows) => rows[0])
        : await withRetry(() =>
            db
              .select({ id: caretakerProperties.id })
              .from(caretakerProperties)
              .where(
                and(
                  eq(caretakerProperties.propertyId, propertyId),
                  eq(caretakerProperties.caretakerId, session.userId),
                ),
              )
              .limit(1),
          ).then((rows) => rows[0])

    if (!allowedProperty) {
      return fail(403, { message: 'You do not have access to this property' })
    }

    if (assignedTo) {
      const landlordId = scope.role === 'landlord' ? session.userId : scope.invitedBy
      if (!landlordId) {
        return fail(400, { message: 'Invalid caretaker assignment' })
      }

      const [caretaker] = await withRetry(() =>
        db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, assignedTo), eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId)))
          .limit(1),
      )

      if (!caretaker) {
        return fail(400, { message: 'Caretaker must belong to this landlord' })
      }
    }

    let createdId = ''
    const safeCategory = category as TicketCategory
    try {
      const created = await createTicket(
        {
          propertyId,
          unitId,
          category: safeCategory,
          description,
          assignedTo: assignedTo || null,
          internalNote: internalNote || null,
        },
        session.userId,
      )
      createdId = created.id
    } catch (error) {
      if (error instanceof Response) throw error
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to create ticket',
      })
    }

    throw redirect(303, `/maintenance/${createdId}`)
  },
}
