import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  getUnitById,
  getUnitFilterProperties,
  getUnitMaintenanceTickets,
  getUnitPaymentHistory,
  getUnitStats,
  logUnitActivity,
  unitAccessibleToCaretaker,
  unitBelongsToLandlord,
  updateUnit,
} from '$lib/services/units'
import { getPropertyById } from '$lib/services/properties'

const PAYMENT_PAGE_SIZE = 10

function parsePositiveNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value?.toString().trim() ?? '')
  return Number.isFinite(parsed) ? parsed : NaN
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const unitId = event.params.id

  const unit = await getUnitById(unitId)
  if (!unit) {
    throw redirect(302, '/units')
  }

  const hasAccess =
    session.role === 'landlord'
      ? unit.propertyOwnerId === session.userId
      : await unitAccessibleToCaretaker(unitId, session.userId)

  if (!hasAccess) {
    throw redirect(302, '/units')
  }

  const payPageParam = Number(event.url.searchParams.get('payPage') ?? '1')
  const paymentPage = Number.isFinite(payPageParam) && payPageParam > 0 ? Math.floor(payPageParam) : 1

  const [stats, paymentHistory, tickets, properties] = await Promise.all([
    getUnitStats(unitId),
    getUnitPaymentHistory(unitId, paymentPage, PAYMENT_PAGE_SIZE),
    getUnitMaintenanceTickets(unitId, 5),
    getUnitFilterProperties(session.userId),
  ])

  const paymentTotalPages = Math.max(1, Math.ceil(paymentHistory.totalCount / PAYMENT_PAGE_SIZE))

  return {
    user: session,
    unit,
    stats,
    payments: paymentHistory.payments,
    paymentTotalCount: paymentHistory.totalCount,
    paymentPage,
    paymentTotalPages,
    tickets,
    properties,
  }
}

export const actions: Actions = {
  updateUnit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update units' })
    }

    const unitId = event.params.id
    const belongs = await unitBelongsToLandlord(unitId, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Unit not found' })
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
      const updated = await updateUnit(unitId, {
        propertyId,
        unitNumber,
        monthlyRent,
        paymentReference: paymentReference || null,
        status,
      })

      if (!updated) return fail(404, { message: 'Unit not found' })

      await logUnitActivity(session.userId, 'unit_updated', unitId, {
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
}
