import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  getOpenPropertyTickets,
  getPropertyById,
  getPropertyStats,
  getPropertyUnits,
  getRecentPropertyPayments,
  isPropertyAssignedToCaretaker,
  updateProperty,
} from '$lib/services/properties'
import { db } from '$lib/server/db'
import { activityLogs } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const propertyId = event.params.id

  const property = await getPropertyById(propertyId)
  if (!property) {
    throw redirect(302, '/properties')
  }

  const hasAccess =
    session.role === 'landlord'
      ? property.ownerId === session.userId
      : await isPropertyAssignedToCaretaker(session.userId, propertyId)

  if (!hasAccess) {
    throw redirect(302, '/properties')
  }

  const [stats, units, recentPayments, recentTickets] = await Promise.all([
    getPropertyStats(propertyId),
    getPropertyUnits(propertyId),
    getRecentPropertyPayments(propertyId, 5),
    getOpenPropertyTickets(propertyId, 5),
  ])

  return {
    user: session,
    property,
    stats,
    units,
    recentPayments,
    recentTickets,
  }
}

export const actions: Actions = {
  updateProperty: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update properties' })
    }

    const propertyId = event.params.id
    const existing = await getPropertyById(propertyId)
    if (!existing || existing.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    const form = await event.request.formData()
    const name = form.get('name')?.toString().trim() ?? ''
    const location = form.get('location')?.toString().trim() ?? ''
    const totalUnits = Number(form.get('totalUnits')?.toString() ?? '0')
    const caretakerName = form.get('caretakerName')?.toString().trim() ?? ''
    const caretakerPhone = form.get('caretakerPhone')?.toString().trim() ?? ''
    const notes = form.get('notes')?.toString().trim() ?? ''

    const errors: { name?: string; location?: string } = {}
    if (!name) errors.name = 'Property name is required'
    if (!location) errors.location = 'Location is required'
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const updated = await updateProperty(propertyId, {
      name,
      location,
      totalUnits,
      caretakerName: caretakerName || null,
      caretakerPhone: caretakerPhone || null,
      notes: notes || null,
    })

    if (!updated) {
      return fail(404, { message: 'Property not found' })
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'property_updated',
        entityType: 'property',
        entityId: propertyId,
        metadata: { propertyName: updated.name },
      }),
    )

    return {
      success: true,
      message: 'Property updated',
    }
  },
}
