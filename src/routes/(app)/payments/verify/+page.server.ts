import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getPendingPayments, confirmPayment, rejectPayment } from '$lib/services/payments'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'landlord') {
    throw redirect(303, '/payments')
  }

  const payments = await getPendingPayments(session.userId)

  return {
    payments,
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
