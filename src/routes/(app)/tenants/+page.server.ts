import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { normalizePhone, requireAuth } from '$lib/server/auth'
import { getPropertyById } from '$lib/services/properties'
import {
  assignUnit,
  createTenant,
  getTenantById,
  getTenantFilterProperties,
  getTenantsByCaretaker,
  getTenantsByLandlord,
  logTenantActivity,
  moveOutTenant,
  removeTenant,
  tenantBelongsToLandlord,
  updateTenant,
} from '$lib/services/tenants'

const PAGE_SIZE = 10

function parsePositiveNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value?.toString().trim() ?? '')
  return Number.isFinite(parsed) ? parsed : NaN
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const pageParam = Number(event.url.searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1

  const selectedProperty = event.url.searchParams.get('property')
  const statusParam = event.url.searchParams.get('status')
  const selectedStatus: 'all' | 'active' | 'inactive' | 'moved_out' =
    statusParam === 'active' || statusParam === 'inactive' || statusParam === 'moved_out'
      ? statusParam
      : 'all'

  const filters = {
    propertyId: selectedProperty || null,
    status: selectedStatus,
  }

  const result =
    session.role === 'landlord'
      ? await getTenantsByLandlord(session.userId, currentPage, PAGE_SIZE, filters)
      : await getTenantsByCaretaker(session.userId, currentPage, PAGE_SIZE, filters)

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))
  const properties = await getTenantFilterProperties(session.userId)

  return {
    tenants: result.tenants,
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
  createTenant: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can add tenants' })
    }

    const form = await event.request.formData()
    const fullName = form.get('fullName')?.toString().trim() ?? form.get('full_name')?.toString().trim() ?? ''
    const phoneNumber = form.get('phoneNumber')?.toString().trim() ?? form.get('phone_number')?.toString().trim() ?? ''
    const idNumber = form.get('idNumber')?.toString().trim() ?? form.get('id_number')?.toString().trim() ?? ''
    const propertyId = form.get('propertyId')?.toString().trim() ?? form.get('property_id')?.toString().trim() ?? ''
    const unitId = form.get('unitId')?.toString().trim() ?? form.get('unit_id')?.toString().trim() ?? ''
    const moveInDate = form.get('moveInDate')?.toString().trim() ?? form.get('move_in_date')?.toString().trim() ?? ''
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
    if (!propertyId) errors.propertyId = 'Property is required'
    if (!unitId) errors.unitId = 'Unit is required'
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    if (!moveInDate || !isValidDate(moveInDate)) {
      errors.moveInDate = 'Move in date is required'
    } else if (moveInDate > today) {
      errors.moveInDate = 'Move in date cannot be in the future'
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

    const property = await getPropertyById(propertyId)
    if (!property || property.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    try {
      const created = await createTenant({
        fullName,
        phoneNumber,
        idNumber: idNumber || null,
        propertyId,
        unitId,
        moveInDate,
        rentDueDay,
        securityDeposit: securityDeposit || 0,
      })

      await logTenantActivity(session.userId, 'tenant_added', created.id, {
        tenantName: created.fullName,
        propertyId,
        unitId,
      })

      return { success: true, id: created.id, message: 'Tenant added' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to add tenant',
      })
    }
  },

  updateTenant: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can update tenants' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    const fullName = form.get('fullName')?.toString().trim() ?? form.get('full_name')?.toString().trim() ?? ''
    const phoneNumber = form.get('phoneNumber')?.toString().trim() ?? form.get('phone_number')?.toString().trim() ?? ''
    const idNumber = form.get('idNumber')?.toString().trim() ?? form.get('id_number')?.toString().trim() ?? ''
    const rentDueDay = parsePositiveNumber(form.get('rentDueDay') ?? form.get('rent_due_day'))
    const securityDeposit = parsePositiveNumber(form.get('securityDeposit') ?? form.get('security_deposit'))

    const errors: Record<string, string> = {}
    if (!id) errors.id = 'Tenant id is required'
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

    const belongs = await tenantBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
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

  assignUnit: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can assign units' })
    }

    const form = await event.request.formData()
    const tenantId = form.get('tenantId')?.toString().trim() ?? form.get('tenant_id')?.toString().trim() ?? ''
    const propertyId = form.get('propertyId')?.toString().trim() ?? form.get('property_id')?.toString().trim() ?? ''
    const unitId = form.get('unitId')?.toString().trim() ?? form.get('unit_id')?.toString().trim() ?? ''

    const errors: Record<string, string> = {}
    if (!tenantId) errors.tenantId = 'Tenant is required'
    if (!propertyId) errors.propertyId = 'Property is required'
    if (!unitId) errors.unitId = 'Unit is required'
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const belongs = await tenantBelongsToLandlord(tenantId, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    const property = await getPropertyById(propertyId)
    if (!property || property.ownerId !== session.userId) {
      return fail(404, { message: 'Property not found' })
    }

    try {
      const updated = await assignUnit(tenantId, propertyId, unitId)
      await logTenantActivity(session.userId, 'tenant_assigned_unit', tenantId, {
        tenantName: updated.tenant.fullName,
        propertyId,
        unitId,
      })
      return { success: true, message: 'Unit assigned' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to assign unit',
      })
    }
  },

  moveOut: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can move out tenants' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''
    const moveOutDate = form.get('moveOutDate')?.toString().trim() ?? form.get('move_out_date')?.toString().trim() ?? ''

    const errors: Record<string, string> = {}
    if (!id) errors.id = 'Tenant id is required'
    if (!moveOutDate || !isValidDate(moveOutDate)) errors.moveOutDate = 'Move out date is required'
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const belongs = await tenantBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
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

  removeTenant: async (event) => {
    const session = await requireAuth(event)
    if (session.role !== 'landlord') {
      return fail(403, { message: 'Only landlords can remove tenants' })
    }

    const form = await event.request.formData()
    const id = form.get('id')?.toString().trim() ?? ''

    if (!id) {
      return fail(400, { message: 'Tenant id is required', errors: { id: 'Tenant id is required' } })
    }

    const belongs = await tenantBelongsToLandlord(id, session.userId)
    if (!belongs) {
      return fail(404, { message: 'Tenant not found' })
    }

    const tenant = await getTenantById(id)

    try {
      await removeTenant(id)
      await logTenantActivity(session.userId, 'tenant_removed', id, {
        tenantName: tenant?.fullName,
      })
      return { success: true, message: 'Tenant removed' }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to remove tenant',
      })
    }
  },
}
