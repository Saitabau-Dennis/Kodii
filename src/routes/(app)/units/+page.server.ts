import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  createUnit,
  deleteUnit,
  getUnitById,
  getUnitFilterProperties,
  getUnitsByCaretaker,
  getUnitsByLandlord,
  logUnitActivity,
  markUnitInactive,
  markUnitVacant,
  unitBelongsToLandlord,
  updateUnit,
} from '$lib/services/units'
import { getPropertyById } from '$lib/services/properties'

const PAGE_SIZE = 10

function parsePositiveNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value?.toString().trim() ?? '')
  return Number.isFinite(parsed) ? parsed : NaN
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const pageParam = Number(event.url.searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1

  const selectedProperty = event.url.searchParams.get('property')
  const statusParam = event.url.searchParams.get('status')
  const selectedStatus: 'all' | 'occupied' | 'vacant' | 'inactive' =
    statusParam === 'occupied' || statusParam === 'vacant' || statusParam === 'inactive'
      ? statusParam
      : 'all'

  const filters = {
    propertyId: selectedProperty || null,
    status: selectedStatus,
  }

  const result =
    session.role === 'landlord'
      ? await getUnitsByLandlord(session.userId, currentPage, PAGE_SIZE, filters)
      : await getUnitsByCaretaker(session.userId, currentPage, PAGE_SIZE, filters)

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))
  const properties = await getUnitFilterProperties(session.userId)

  return {
    units: result.units,
    totalCount: result.totalCount,
    currentPage,
    totalPages,
    properties,
    selectedProperty: selectedProperty ?? '',
    selectedStatus,
    user: session,
  }
}

export const actions: Actions = {
  createUnit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can add units' })
    }

    const form = await event.request.formData()
    const propertyId = form.get('propertyId')?.toString().trim() ?? ''
    const unitNumber = form.get('unitNumber')?.toString().trim() ?? ''
    const monthlyRent = parsePositiveNumber(form.get('monthlyRent'))
    const paymentReference = form.get('paymentReference')?.toString().trim() ?? ''
    const rawStatus = form.get('status')?.toString().trim() ?? 'vacant'
    const status = rawStatus === 'inactive' ? 'inactive' : 'vacant'

    const errors: Record<string, string> = {}
    if (!propertyId) errors.propertyId = 'Property is required'
    if (!unitNumber) errors.unitNumber = 'Unit number is required'
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      errors.monthlyRent = 'Monthly rent must be a positive number'
    }
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const property = await getPropertyById(propertyId)
    if (!property || property.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    try {
      const created = await createUnit({
        propertyId,
        unitNumber,
        monthlyRent,
        paymentReference: paymentReference || null,
        status,
      })

      await logUnitActivity(session.userId, 'unit_added', created.id, {
        unitNumber: created.unitNumber,
        propertyId: created.propertyId,
      })

      return { success: true, id: created.id, message: 'Unit added' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to add unit',
      })
    }
  },

  updateUnit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update units' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    const propertyId = form.get('propertyId')?.toString().trim() ?? ''
    const unitNumber = form.get('unitNumber')?.toString().trim() ?? ''
    const monthlyRent = parsePositiveNumber(form.get('monthlyRent'))
    const paymentReference = form.get('paymentReference')?.toString().trim() ?? ''
    const rawStatus = form.get('status')?.toString().trim() ?? 'vacant'
    const status = rawStatus === 'inactive' ? 'inactive' : 'vacant'

    const errors: Record<string, string> = {}
    if (!id) errors.id = 'Unit id is required'
    if (!propertyId) errors.propertyId = 'Property is required'
    if (!unitNumber) errors.unitNumber = 'Unit number is required'
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      errors.monthlyRent = 'Monthly rent must be a positive number'
    }
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const belongs = await unitBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Unit not found' })
    }

    const property = await getPropertyById(propertyId)
    if (!property || property.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    try {
      const updated = await updateUnit(id, {
        propertyId,
        unitNumber,
        monthlyRent,
        paymentReference: paymentReference || null,
        status,
      })

      if (!updated) {
        return fail(404, { message: 'Unit not found' })
      }

      await logUnitActivity(session.userId, 'unit_updated', id, {
        unitNumber: updated.unitNumber,
        propertyId: updated.propertyId,
      })

      return { success: true, message: 'Unit updated' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to update unit',
      })
    }
  },

  deleteUnit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can delete units' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) {
      return fail(400, { message: 'Unit id is required', errors: { id: 'Unit id is required' } })
    }

    const unit = await getUnitById(id)
    if (!unit || unit.propertyOwnerId !== session.userId) {
      return fail(404, { message: 'Unit not found' })
    }

    try {
      await deleteUnit(id)
      await logUnitActivity(session.userId, 'unit_deleted', id, {
        unitNumber: unit.unitNumber,
        propertyId: unit.propertyId,
      })
      return { success: true, message: 'Unit deleted' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to delete unit',
      })
    }
  },

  markVacant: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can mark units vacant' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) return fail(400, { message: 'Unit id is required' })

    const unit = await getUnitById(id)
    if (!unit || unit.propertyOwnerId !== session.userId) {
      return fail(404, { message: 'Unit not found' })
    }

    await markUnitVacant(id)
    await logUnitActivity(session.userId, 'unit_marked_vacant', id, {
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
    })

    return { success: true, message: 'Unit marked vacant' }
  },

  markInactive: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can mark units inactive' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    if (!id) return fail(400, { message: 'Unit id is required' })

    const unit = await getUnitById(id)
    if (!unit || unit.propertyOwnerId !== session.userId) {
      return fail(404, { message: 'Unit not found' })
    }

    await markUnitInactive(id)
    await logUnitActivity(session.userId, 'unit_marked_inactive', id, {
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
    })

    return { success: true, message: 'Unit marked inactive' }
  },
}
