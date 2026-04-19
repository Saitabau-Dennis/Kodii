import { json } from '@sveltejs/kit'
import type { RequestHandler } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { getPropertyById, isPropertyAssignedToCaretaker } from '$lib/services/properties'
import { getVacantUnitsByProperty } from '$lib/services/tenants'

export const GET: RequestHandler = async (event) => {
  const session = await requireAuth(event)
  const propertyId = event.params.id
  if (!propertyId) {
    return json({ message: 'Property id is required' }, { status: 400 })
  }

  const property = await getPropertyById(propertyId)
  if (!property) {
    return json({ message: 'Property not found' }, { status: 404 })
  }

  const hasAccess =
    session.role === 'landlord'
      ? property.ownerId === session.userId
      : await isPropertyAssignedToCaretaker(session.userId, propertyId)

  if (!hasAccess) {
    return json({ message: 'Forbidden' }, { status: 403 })
  }

  const units = await getVacantUnitsByProperty(propertyId)
  return json(units)
}
