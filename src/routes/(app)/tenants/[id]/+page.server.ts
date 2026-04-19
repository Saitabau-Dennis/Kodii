import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { normalizePhone, requireAuth } from '$lib/server/auth'
import {
  applyDepositToDebt,
  getTenantById,
  getTenantFilterProperties,
  getTenantInvoices,
  getTenantMaintenanceTickets,
  getTenantNotices,
  getTenantPaymentHistory,
  getTenantStats,
  logTenantActivity,
  moveOutTenant,
  tenantAccessibleToCaretaker,
  tenantBelongsToLandlord,
  updateTenant,
  writeOffInvoice,
} from '$lib/services/tenants'
import { sendRentInvoiceSMS } from '$lib/services/invoices'

const PAYMENT_PAGE_SIZE = 10

function parsePositiveNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value?.toString().trim() ?? '')
  return Number.isFinite(parsed) ? parsed : NaN
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const tenantId = event.params.id

  const tenant = await getTenantById(tenantId)
  if (!tenant) {
    throw redirect(302, '/tenants')
  }

  const hasAccess =
    session.role === 'landlord'
      ? tenant.propertyOwnerId === session.userId
      : await tenantAccessibleToCaretaker(tenantId, session.userId)

  if (!hasAccess) {
    throw redirect(302, '/tenants')
  }

  const payPageParam = Number(event.url.searchParams.get('payPage') ?? '1')
  const paymentPage = Number.isFinite(payPageParam) && payPageParam > 0 ? Math.floor(payPageParam) : 1

  const [stats, paymentHistory, tickets, tenantNotices, properties, invoices] = await Promise.all([
    getTenantStats(tenantId),
    getTenantPaymentHistory(tenantId, paymentPage, PAYMENT_PAGE_SIZE),
    getTenantMaintenanceTickets(tenantId, 5),
    getTenantNotices(tenantId, 5),
    getTenantFilterProperties(session.userId),
    getTenantInvoices(tenantId),
  ])

  const paymentTotalPages = Math.max(1, Math.ceil(paymentHistory.totalCount / PAYMENT_PAGE_SIZE))

  return {
    user: session,
    tenant,
    stats,
    payments: paymentHistory.payments,
    paymentTotalCount: paymentHistory.totalCount,
    paymentPage,
    paymentTotalPages,
    tickets,
    notices: tenantNotices,
    properties,
    invoices,
  }
}

export const actions: Actions = {
  updateTenant: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update tenants' })
    }

    const id = event.params.id
    const belongs = await tenantBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    const form = await event.request.formData()
    const fullName = form.get('fullName')?.toString().trim() ?? form.get('full_name')?.toString().trim() ?? ''
    const phoneNumber = form.get('phoneNumber')?.toString().trim() ?? form.get('phone_number')?.toString().trim() ?? ''
    const idNumber = form.get('idNumber')?.toString().trim() ?? form.get('id_number')?.toString().trim() ?? ''
    const rentDueDay = parsePositiveNumber(form.get('rentDueDay') ?? form.get('rent_due_day'))
    const securityDeposit = parsePositiveNumber(form.get('securityDeposit') ?? form.get('security_deposit'))

    const errors: Record<string, string> = {}
    if (!fullName || fullName.length < 2) errors.fullName = 'Full name must be at least 2 characters'
    if (!phoneNumber) {
      errors.phoneNumber = 'Phone number is required'
    } else {
      try {
        normalizePhone(phoneNumber)
      } catch {
        errors.phoneNumber = 'Enter a valid Kenyan phone number'
      }
    }
    if (!Number.isFinite(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) {
      errors.rentDueDay = 'Rent due day must be between 1 and 28'
    }
    if (Number.isNaN(securityDeposit) || securityDeposit < 0) {
      errors.securityDeposit = 'Security deposit must be a valid positive number'
    }
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    try {
      const updated = await updateTenant(id, {
        fullName,
        phoneNumber,
        idNumber: idNumber || null,
        rentDueDay,
        securityDeposit: securityDeposit || 0,
      })
      if (!updated) return fail(404, { message: 'Tenant not found' })

      await logTenantActivity(session.userId, 'tenant_updated', id, {
        tenantName: updated.fullName,
      })

      return { success: true, message: 'Tenant updated' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to update tenant',
      })
    }
  },

  moveOut: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can move out tenants' })
    }

    const id = event.params.id
    const belongs = await tenantBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    const form = await event.request.formData()
    const moveOutDate = form.get('moveOutDate')?.toString().trim() ?? form.get('move_out_date')?.toString().trim() ?? ''

    const errors: Record<string, string> = {}
    if (!moveOutDate || !isValidDate(moveOutDate)) errors.moveOutDate = 'Move out date is required'
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    try {
      await moveOutTenant(id, moveOutDate)
      await logTenantActivity(session.userId, 'tenant_moved_out', id, { moveOutDate })
      return { success: true, message: 'Tenant moved out' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to move out tenant',
      })
    }
  },

  applyDeposit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can apply deposits' })
    }

    const tenantId = event.params.id
    const belongs = await tenantBelongsToLandlord(tenantId, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    try {
      const result = await applyDepositToDebt(tenantId, session.userId)
      return {
        success: true,
        message: `Applied deposit. Remaining: ${result.remainingDeposit}, Invoices cleared: ${result.clearedInvoices}`,
      }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to apply deposit',
      })
    }
  },

  writeOffInvoice: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can write off debt' })
    }

    const tenantId = event.params.id
    const belongs = await tenantBelongsToLandlord(tenantId, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    const form = await event.request.formData()
    const invoiceId = form.get('invoiceId')?.toString().trim() ?? ''

    if (!invoiceId) {
      return fail(400, { message: 'Invoice ID is required' })
    }

    try {
      await writeOffInvoice(invoiceId, tenantId, session.userId)
      return { success: true, message: 'Debt written off' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to write off debt',
      })
    }
  },

  resendInvoiceSMS: async (event) => {
    const session = await requireAuth(event)
    const tenantId = event.params.id
    
    // Authorization check
    const tenant = await getTenantById(tenantId)
    if (!tenant) return fail(404, { message: 'Tenant not found' })
    
    const hasAccess = session.role === 'landlord' 
      ? tenant.propertyOwnerId === session.userId
      : await tenantAccessibleToCaretaker(tenantId, session.userId)
      
    if (!hasAccess) return fail(403, { message: 'Unauthorized' })

    const invoices = await getTenantInvoices(tenantId)
    const latestUnpaid = invoices.find(i => ['unpaid', 'partial', 'overdue'].includes(i.status))

    if (!latestUnpaid) {
      return fail(400, { message: 'No unpaid invoices found for this tenant' })
    }

    try {
      await sendRentInvoiceSMS(latestUnpaid.id)
      return { success: true, message: 'Invoice SMS sent successfully' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Failed to send SMS',
      })
    }
  },
}
