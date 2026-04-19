import type { PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getTicketsByCaretaker, getTicketsByLandlord } from '$lib/services/maintenance'
import { withRetry } from '$lib/db/retry'
import { caretakerProperties, properties } from '$lib/db/schema'
import { db } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import type { TicketCategory, TicketStatus } from '$lib/types/maintenance'

const PAGE_SIZE = 10

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1')
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function parseStatus(value: string | null): TicketStatus | 'all' {
  if (value === 'open' || value === 'in_progress' || value === 'resolved' || value === 'closed') {
    return value
  }
  return 'all'
}

function parseCategory(value: string | null): TicketCategory | 'all' {
  if (
    value === 'water' ||
    value === 'electricity' ||
    value === 'plumbing' ||
    value === 'security' ||
    value === 'other'
  ) {
    return value
  }
  return 'all'
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const currentPage = parsePage(event.url.searchParams.get('page'))
  const selectedProperty = event.url.searchParams.get('property') ?? ''
  const selectedStatus = parseStatus(event.url.searchParams.get('status'))
  const selectedCategory = parseCategory(event.url.searchParams.get('category'))
  const selectedUnit = event.url.searchParams.get('unit') ?? ''
  const selectedTenant = event.url.searchParams.get('tenant') ?? ''

  const filters = {
    propertyId: selectedProperty || null,
    status: selectedStatus,
    category: selectedCategory,
    unitId: selectedUnit || null,
    tenantId: selectedTenant || null,
  }

  const result =
    session.role === 'landlord'
      ? await getTicketsByLandlord(session.userId, currentPage, PAGE_SIZE, filters)
      : await getTicketsByCaretaker(session.userId, currentPage, PAGE_SIZE, filters)

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

  const propertyRows =
    session.role === 'landlord'
      ? await withRetry(() =>
          db
            .select({ id: properties.id, name: properties.name })
            .from(properties)
            .where(eq(properties.ownerId, session.userId))
            .orderBy(properties.name),
        )
      : await withRetry(() =>
          db
            .select({ id: properties.id, name: properties.name })
            .from(caretakerProperties)
            .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
            .where(eq(caretakerProperties.caretakerId, session.userId))
            .orderBy(properties.name),
        )

  return {
    tickets: result.tickets,
    totalCount: result.totalCount,
    currentPage,
    totalPages,
    properties: propertyRows,
    selectedProperty,
    selectedStatus,
    selectedCategory,
    selectedUnit,
    selectedTenant,
    user: session,
  }
}
