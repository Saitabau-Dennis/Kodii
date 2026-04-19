import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  createProperty,
  deleteProperty,
  getPropertyById,
  getPropertiesByCaretaker,
  getPropertiesByLandlord,
  updateProperty,
} from '$lib/services/properties'
import { db } from '$lib/server/db'
import { activityLogs } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'

const PAGE_SIZE = 10

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const pageParam = Number(event.url.searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1

  const result =
    session.role === 'landlord'
      ? await getPropertiesByLandlord(session.userId, currentPage, PAGE_SIZE)
      : await getPropertiesByCaretaker(session.userId, currentPage, PAGE_SIZE)

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

  return {
    properties: result.properties,
    totalCount: result.totalCount,
    currentPage,
    totalPages,
    user: session,
  }
}

export const actions: Actions = {
  createProperty: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can create properties' })
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

    const created = await createProperty(
      {
        name,
        location,
        totalUnits,
        caretakerName: caretakerName || null,
        caretakerPhone: caretakerPhone || null,
        notes: notes || null,
      },
      session.userId,
    )

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'property_created',
        entityType: 'property',
        entityId: created.id,
        metadata: { propertyName: created.name },
      }),
    )

    return {
      success: true,
      id: created.id,
      message: 'Property added',
    }
  },

  updateProperty: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update properties' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    const name = form.get('name')?.toString().trim() ?? ''
    const location = form.get('location')?.toString().trim() ?? ''
    const totalUnits = Number(form.get('totalUnits')?.toString() ?? '0')
    const caretakerName = form.get('caretakerName')?.toString().trim() ?? ''
    const caretakerPhone = form.get('caretakerPhone')?.toString().trim() ?? ''
    const notes = form.get('notes')?.toString().trim() ?? ''

    const errors: { id?: string; name?: string; location?: string } = {}
    if (!id) errors.id = 'Property id is required'
    if (!name) errors.name = 'Property name is required'
    if (!location) errors.location = 'Location is required'
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const existing = await getPropertyById(id)
    if (!existing || existing.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    const updated = await updateProperty(id, {
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
        entityId: updated.id,
        metadata: { propertyName: updated.name },
      }),
    )

    return {
      success: true,
      message: 'Property updated',
    }
  },

  deleteProperty: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can delete properties' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) {
      return fail(400, { message: 'Property id is required', errors: { id: 'Property id is required' } })
    }

    const existing = await getPropertyById(id)
    if (!existing || existing.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    try {
      await deleteProperty(id)
    } catch (error) {
      return fail(400, {
        message:
          error instanceof Error ? error.message : 'Cannot delete property right now',
      })
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'property_deleted',
        entityType: 'property',
        entityId: existing.id,
        metadata: { propertyName: existing.name },
      }),
    )

    return {
      success: true,
      message: 'Property deleted',
    }
  },
}
