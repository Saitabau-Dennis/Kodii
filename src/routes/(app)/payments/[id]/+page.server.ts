import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getPaymentById } from '$lib/services/payments'
import { tenantBelongsToLandlord } from '$lib/services/tenants'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const { id } = event.params

  const payment = await getPaymentById(id)
  if (!payment) {
    throw redirect(303, '/payments')
  }

  // Verify access
  const belongs = await tenantBelongsToLandlord(payment.tenantId, session.userId)
  if (!belongs) {
    throw error(403, 'You do not have access to this payment')
  }

  return {
    payment,
    user: session,
  }
}
