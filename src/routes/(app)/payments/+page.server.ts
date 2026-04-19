import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  getPaymentsByLandlord,
  getPendingPayments,
  confirmPayment,
  rejectPayment,
} from '$lib/services/payments'
import { getPropertiesByLandlord, getPropertiesByCaretaker } from '$lib/services/properties'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const page = Number(event.url.searchParams.get('page') ?? '1')
  const status = event.url.searchParams.get('status')
  const propertyId = event.url.searchParams.get('property')
  const unitId = event.url.searchParams.get('unit')
  const tenantId = event.url.searchParams.get('tenant')
  const q = event.url.searchParams.get('q')

  const { payments, totalCount } = await getPaymentsByLandlord(session.userId, page, 10, {
    status,
    propertyId,
    unitId,
    tenantId,
    search: q,
  })

  const pendingPayments = await getPendingPayments(session.userId)
  const propertiesResult =
    session.role === 'landlord'
      ? await getPropertiesByLandlord(session.userId, 1, 100)
      : await getPropertiesByCaretaker(session.userId, 1, 100)

  return {
    payments,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / 10),
    pendingPayments,
    pendingCount: pendingPayments.length,
    properties: propertiesResult.properties,
    user: session,
  }
}

export const actions: Actions = {
  confirmPayment: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can verify payments' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString()
    const amountReceived = parseFloat(form.get('amountReceived')?.toString() ?? '0')

    if (!id || isNaN(amountReceived) || amountReceived <= 0) {
      return fail(400, { message: 'Invalid payment data' })
    }

    try {
      await confirmPayment(id, amountReceived, session.userId)
      return { success: true }
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Action failed' })
    }
  },

  rejectPayment: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can verify payments' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString()
    const reason = form.get('reason')?.toString()

    if (!id || !reason) {
      return fail(400, { message: 'ID and reason are required' })
    }

    try {
      await rejectPayment(id, reason, session.userId)
      return { success: true }
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Action failed' })
    }
  },
}
